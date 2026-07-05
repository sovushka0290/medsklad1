import 'package:flutter/foundation.dart';

class PushNotificationService {
  static Future<void> initialize() async {
    // В реальном приложении здесь будет настройка Firebase Messaging
    if (kDebugMode) {
      print('Push notifications initialized (stub)');
    }
  }

  static Future<String?> getToken() async {
    // В реальном приложении здесь будет запрос токена устройства
    return 'mock_push_token_12345';
  }
}
