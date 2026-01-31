import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Loads Google reCAPTCHA v2 in a WebView and returns the token via [onSuccess].
/// Uses [webview_flutter] to avoid dependency conflicts with Firebase.
class RecaptchaWebView extends StatefulWidget {
  final String siteKey;
  final void Function(String token) onSuccess;

  const RecaptchaWebView({
    super.key,
    required this.siteKey,
    required this.onSuccess,
  });

  @override
  State<RecaptchaWebView> createState() => _RecaptchaWebViewState();
}

class _RecaptchaWebViewState extends State<RecaptchaWebView> {
  late final WebViewController _controller;
  bool _loading = true;

  static String _buildHtml(String siteKey) {
    return '''
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://www.google.com/recaptcha/api.js" async defer></script>
  <style>
    body { margin: 0; padding: 16px; display: flex; justify-content: center; align-items: center; min-height: 120px; }
    .g-recaptcha { transform: scale(0.95); transform-origin: 0 0; }
  </style>
</head>
<body>
  <div class="g-recaptcha" data-sitekey="$siteKey" data-callback="onRecaptchaSuccess"></div>
  <script>
    function onRecaptchaSuccess(token) {
      RecaptchaFlutter.postMessage(token);
    }
  </script>
</body>
</html>
''';
  }

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel(
        'RecaptchaFlutter',
        onMessageReceived: (JavaScriptMessage message) {
          widget.onSuccess(message.message);
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
        ),
      )
      ..loadHtmlString(
        _buildHtml(widget.siteKey),
        baseUrl: 'https://www.google.com/recaptcha/',
      );
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        WebViewWidget(controller: _controller),
        if (_loading)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(),
            ),
          ),
      ],
    );
  }
}
