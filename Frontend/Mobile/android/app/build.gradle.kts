import com.android.build.api.artifact.SingleArtifact
import java.io.File
import java.nio.file.Files

plugins {
    id("com.android.application")
    // START: FlutterFire Configuration
    id("com.google.gms.google-services")
    // END: FlutterFire Configuration
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.example.rescuelink_mobile"
    compileSdk = 36
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.example.rescuelink_mobile"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion // Required for local_auth biometric
        targetSdk = 36
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

fun rescueLinkApkFileName(versionName: String?, versionCode: Int?): String {
    val safeName = (versionName ?: "0").replace(Regex("[\\\\/:*?\"<>|]"), "_")
    val code = versionCode ?: 1
    return "RescueLink_App_${safeName}_$code.apk"
}

fun org.gradle.api.Project.linkLegacyReleaseApk(outDir: File, brandedFile: File) {
    val legacy = File(outDir, "app-release.apk")
    if (legacy.absolutePath.equals(brandedFile.absolutePath, ignoreCase = true)) return
    legacy.delete()
    try {
        Files.createLink(legacy.toPath(), brandedFile.toPath())
    } catch (_: Exception) {
        brandedFile.copyTo(legacy, overwrite = true)
    }
}

fun org.gradle.api.Project.publishRescueLinkApk(
    outputDirs: List<File>,
    versionName: String?,
    versionCode: Int?,
    sourceCandidates: List<File>,
) {
    val brandedName = rescueLinkApkFileName(versionName, versionCode)
    val source = sourceCandidates.firstOrNull { it.isFile }
        ?: error("RescueLink APK publish: no release APK found (checked ${sourceCandidates.size} path(s))")

    outputDirs.forEach { outDir ->
        outDir.mkdirs()
        val brandedFile = File(outDir, brandedName)
        source.copyTo(brandedFile, overwrite = true)
        // Flutter CLI / AGP still expect app-release.apk in these folders.
        linkLegacyReleaseApk(outDir, brandedFile)
        logger.lifecycle("RescueLink release APK: ${brandedFile.absolutePath}")
    }
}

// AGP 9+: after assembleRelease (and Flutter's flutter-apk copy), publish branded APK name.
androidComponents {
    onVariants { variant ->
        if (variant.name != "release") return@onVariants

        val apkFolder = variant.artifacts.get(SingleArtifact.APK)
        val loader = variant.artifacts.getBuiltArtifactsLoader()
        val flutterApkDir = layout.buildDirectory.dir("outputs/flutter-apk")

        val publishTask = tasks.register("publishRescueLinkReleaseApk") {
            inputs.files(apkFolder)
            outputs.upToDateWhen { false }

            doLast {
                val versionName = android.defaultConfig.versionName
                val versionCode = android.defaultConfig.versionCode

                val gradleApks = mutableListOf<File>()
                loader.load(apkFolder.get())?.elements?.forEach { element ->
                    gradleApks.add(File(element.outputFile))
                }
                val apkReleaseDir = layout.buildDirectory.dir("outputs/apk/release").get().asFile
                val flutterOut = flutterApkDir.get().asFile
                val sourceCandidates = buildList {
                    addAll(gradleApks)
                    add(File(apkReleaseDir, "app-release.apk"))
                    add(File(flutterOut, "app-release.apk"))
                }

                project.publishRescueLinkApk(
                    outputDirs = listOf(flutterOut, apkReleaseDir),
                    versionName = versionName,
                    versionCode = versionCode,
                    sourceCandidates = sourceCandidates,
                )
            }
        }

        tasks.matching { it.name == "assembleRelease" }.configureEach {
            finalizedBy(publishTask)
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

// Match onesignal_flutter Android SDK so NotificationServiceExtension compiles in :app.
dependencies {
    implementation("com.onesignal:OneSignal:5.9.9")
}
