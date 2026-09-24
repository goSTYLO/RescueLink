import com.android.build.api.artifact.SingleArtifact
import java.io.File

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

// AGP 9+: rename release APK after packaging (Flutter reads from Gradle output).
androidComponents {
    onVariants { variant ->
        if (variant.buildType != "release") return@onVariants

        val apkFolder = variant.artifacts.get(SingleArtifact.APK)
        val loader = variant.artifacts.getBuiltArtifactsLoader()
        val variantName = variant.name
        val capitalizedVariant =
            variantName.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }

        val flutterApkDir = layout.buildDirectory.dir("outputs/flutter-apk")

        val renameTask = tasks.register("rename${capitalizedVariant}Apk") {
            inputs.files(apkFolder)
            outputs.upToDateWhen { false }

            doLast {
                val builtArtifacts = loader.load(apkFolder.get()) ?: return@doLast
                builtArtifacts.elements.forEach { element ->
                    val apkFile = File(element.outputFile)
                    val safeName = (element.versionName ?: "0").replace(Regex("[\\\\/:*?\"<>|]"), "_")
                    val versionCode = element.versionCode ?: 1
                    val outputFileName = "RescueLink_App_${safeName}_$versionCode.apk"
                    val namedApk = if (apkFile.exists() && apkFile.name != outputFileName) {
                        val target = File(apkFile.parentFile, outputFileName)
                        apkFile.renameTo(target)
                        target
                    } else {
                        apkFile
                    }
                    if (!namedApk.exists()) return@forEach

                    val flutterOut = flutterApkDir.get().asFile
                    flutterOut.mkdirs()
                    // Branded artifact for distribution; keep app-release.apk for Flutter CLI discovery.
                    namedApk.copyTo(File(flutterOut, outputFileName), overwrite = true)
                    namedApk.copyTo(File(flutterOut, "app-release.apk"), overwrite = true)
                }
            }
        }

        tasks.matching { it.name == "assemble$capitalizedVariant" }.configureEach {
            finalizedBy(renameTask)
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
