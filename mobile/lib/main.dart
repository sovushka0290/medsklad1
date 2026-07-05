import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'screens/main_layout.dart';
import 'theme/app_theme.dart';
import 'services/push_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await PushNotificationService.initialize();
  runApp(const MedSkladApp());
}

class MedSkladApp extends StatelessWidget {
  const MedSkladApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MedSklad',
      theme: AppTheme.lightTheme,
      initialRoute: '/login',
      routes: {
        '/login': (context) => const LoginScreen(),
        '/home': (context) => const MainLayout(),
      },
    );
  }
}
