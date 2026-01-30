# Assets Folder

This folder contains SVG image assets for the RescueLink mobile application.

## Folder Structure

- `logo/` - Contains the application logo (SVG format)
- `images/` - Contains illustration images for login and signup screens (SVG format)

## Required Images

### Logo
Place your logo SVG file in the `logo/` folder with the filename:
- `logo.svg`

**Recommended specifications:**
- Format: SVG (Scalable Vector Graphics)
- Size: Vector format scales automatically (will be displayed at 60x60)
- Aspect ratio: Square (1:1) works best
- Benefits: Crisp at any size, smaller file size, supports transparency

### Illustrations
Place your illustration SVG files in the `images/` folder with the filenames:
- `login_illustration.svg` - Illustration for the login screen
- `signup_illustration.svg` - Illustration for the signup screen

**Recommended specifications:**
- Format: SVG (Scalable Vector Graphics)
- Size: Vector format scales automatically (will be displayed at 200px height)
- Aspect ratio: Portrait orientation works best
- Benefits: Crisp at any size, smaller file size, supports transparency

## How to Add Your Images

1. Place your logo SVG file in `assets/logo/` and name it `logo.svg`
2. Place your login illustration SVG in `assets/images/` and name it `login_illustration.svg`
3. Place your signup illustration SVG in `assets/images/` and name it `signup_illustration.svg`
4. Run `flutter pub get` to install the `flutter_svg` package (if not already installed)
5. Restart your app to see the changes

## Changing Image Paths

If you want to use different filenames or paths, you can update them in:
- `lib/screens/login_screen.dart` - Look for `'assets/logo/logo.svg'` and `'assets/images/login_illustration.svg'`
- `lib/screens/signup_screen.dart` - Look for `'assets/logo/logo.svg'` and `'assets/images/signup_illustration.svg'`

## Note

- The app uses the `flutter_svg` package to render SVG images
- If SVG files are not found, the app will display placeholder icons as fallbacks
- SVG format provides better quality and scalability compared to raster images (PNG/JPG)
