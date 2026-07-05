import 'package:flutter/material.dart';
import 'home_screen.dart';
import 'inventory/catalog_screen.dart';
import 'inventory/operation_screen.dart';
import 'procedure_screen.dart';
import '../main.dart'; // import themeNotifier

import 'package:shared_preferences/shared_preferences.dart';

class MainLayout extends StatefulWidget {
  const MainLayout({super.key});

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  int _currentIndex = 0;
  String _userRole = 'USER';
  bool _isLoading = true;
 
  @override
  void initState() {
    super.initState();
    _loadRole();
  }

  Future<void> _loadRole() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _userRole = prefs.getString('role') ?? 'USER';
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final bool canManageInventory = _userRole == 'ADMIN' || _userRole == 'PHARMACIST';

    final List<Widget> screens = [
      const HomeScreen(),
      const CatalogScreen(),
      if (canManageInventory) const OperationScreen(),
      const ProcedureScreen(),
      Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Профиль ($_userRole)', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            ValueListenableBuilder<ThemeMode>(
              valueListenable: themeNotifier,
              builder: (_, ThemeMode currentMode, __) {
                return SwitchListTile(
                  title: const Text('Темная тема'),
                  value: currentMode == ThemeMode.dark,
                  onChanged: (isDark) {
                    themeNotifier.value = isDark ? ThemeMode.dark : ThemeMode.light;
                  },
                );
              },
            ),
          ],
        ),
      ),
    ];

    final List<BottomNavigationBarItem> items = [
      const BottomNavigationBarItem(
        icon: Icon(Icons.dashboard_outlined),
        activeIcon: Icon(Icons.dashboard),
        label: 'Главная',
      ),
      const BottomNavigationBarItem(
        icon: Icon(Icons.inventory_2_outlined),
        activeIcon: Icon(Icons.inventory_2),
        label: 'Каталог',
      ),
      if (canManageInventory)
        const BottomNavigationBarItem(
          icon: Icon(Icons.swap_horiz_outlined),
          activeIcon: Icon(Icons.swap_horiz),
          label: 'Операции',
        ),
      const BottomNavigationBarItem(
        icon: Icon(Icons.medical_services_outlined),
        activeIcon: Icon(Icons.medical_services),
        label: 'Процедуры',
      ),
      const BottomNavigationBarItem(
        icon: Icon(Icons.person_outline),
        activeIcon: Icon(Icons.person),
        label: 'Профиль',
      ),
    ];

    // Ensure _currentIndex is within bounds if role changed dynamically
    if (_currentIndex >= screens.length) {
      _currentIndex = screens.length - 1;
    }

    return Scaffold(
      body: screens[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        type: BottomNavigationBarType.fixed,
        items: items,
      ),
    );
  }
}
