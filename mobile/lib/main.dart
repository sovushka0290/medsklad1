import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'screens/main_layout.dart';
import 'theme/app_theme.dart';
import 'services/push_service.dart';
import 'services/offline_queue.dart';

final ValueNotifier<ThemeMode> themeNotifier = ValueNotifier(ThemeMode.light);

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await PushNotificationService.initialize();
  // Initialize offline queue to start listening to connectivity changes
  OfflineQueue();
  runApp(const MedSkladApp());
}

class MedSkladApp extends StatelessWidget {
  const MedSkladApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeNotifier,
      builder: (_, ThemeMode currentMode, __) {
        return MaterialApp(
          title: 'MedSklad',
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: currentMode,
          initialRoute: '/login',
          routes: {
            '/login': (context) => const LoginScreen(),
            '/home': (context) => const MainLayout(),
          },
        );
      },
    );
  }
}
