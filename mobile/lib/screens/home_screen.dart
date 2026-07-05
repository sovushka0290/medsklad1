import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../services/api_service.dart';
import '../services/offline_queue.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isScanning = false;

  void _onDetect(BarcodeCapture capture) async {
    if (_isScanning) return;
    
    final List<Barcode> barcodes = capture.barcodes;
    if (barcodes.isNotEmpty) {
      final String? code = barcodes.first.rawValue;
      if (code != null) {
        setState(() => _isScanning = true);
        
        try {
          // Attempt API scan
          await ApiService().scanBarcode(code);
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Сканировано: $code')),
          );
        } catch (e) {
          // Fallback to offline queue
          await OfflineQueue().enqueueRequest('/inventory/scan', {'barcode': code});
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Оффлайн. Сканирование добавлено в очередь: $code')),
          );
        }

        // Delay to prevent rapid re-scans
        await Future.delayed(const Duration(seconds: 2));
        if (!mounted) return;
        setState(() => _isScanning = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Сканирование'),
        actions: [
          IconButton(
            icon: const Icon(Icons.sync),
            onPressed: () async {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Синхронизация...')),
              );
              await OfflineQueue().syncQueue();
              if (!mounted) return;
            },
          )
        ],
      ),
      body: MobileScanner(
        onDetect: _onDetect,
      ),
    );
  }
}
