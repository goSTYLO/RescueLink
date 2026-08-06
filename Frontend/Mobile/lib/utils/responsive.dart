enum ScreenSizeClass { compact, regular, expanded }

class Responsive {
  static ScreenSizeClass sizeClass(double width) {
    if (width < 360) return ScreenSizeClass.compact;
    if (width < 430) return ScreenSizeClass.regular;
    return ScreenSizeClass.expanded;
  }

  static bool isCompact(double width) =>
      sizeClass(width) == ScreenSizeClass.compact;

  static double spacingScale(double width) {
    switch (sizeClass(width)) {
      case ScreenSizeClass.compact:
        return 0.9;
      case ScreenSizeClass.regular:
        return 1.0;
      case ScreenSizeClass.expanded:
        return 1.1;
    }
  }

  static double horizontalPadding(double width) {
    switch (sizeClass(width)) {
      case ScreenSizeClass.compact:
        return 14;
      case ScreenSizeClass.regular:
        return 20;
      case ScreenSizeClass.expanded:
        return 24;
    }
  }

  static double logoSize(double width) {
    switch (sizeClass(width)) {
      case ScreenSizeClass.compact:
        return 90;
      case ScreenSizeClass.regular:
        return 105;
      case ScreenSizeClass.expanded:
        return 120;
    }
  }

  static double brandTitleSize(double width) {
    switch (sizeClass(width)) {
      case ScreenSizeClass.compact:
        return 22;
      case ScreenSizeClass.regular:
        return 26;
      case ScreenSizeClass.expanded:
        return 28;
    }
  }

  static double brandSubtitleSize(double width) {
    switch (sizeClass(width)) {
      case ScreenSizeClass.compact:
        return 11;
      case ScreenSizeClass.regular:
        return 12;
      case ScreenSizeClass.expanded:
        return 13;
    }
  }

  static double sosCircleSize(double width) {
    switch (sizeClass(width)) {
      case ScreenSizeClass.compact:
        return 74;
      case ScreenSizeClass.regular:
        return 84;
      case ScreenSizeClass.expanded:
        return 88;
    }
  }

  static double sosIconSize(double width) {
    switch (sizeClass(width)) {
      case ScreenSizeClass.compact:
        return 32;
      case ScreenSizeClass.regular:
        return 36;
      case ScreenSizeClass.expanded:
        return 40;
    }
  }

  static double navItemHorizontalPadding(double width) {
    switch (sizeClass(width)) {
      case ScreenSizeClass.compact:
        return 8;
      case ScreenSizeClass.regular:
        return 12;
      case ScreenSizeClass.expanded:
        return 16;
    }
  }

  static double navLabelSize(double width) {
    switch (sizeClass(width)) {
      case ScreenSizeClass.compact:
        return 11;
      case ScreenSizeClass.regular:
        return 12;
      case ScreenSizeClass.expanded:
        return 12;
    }
  }
}
