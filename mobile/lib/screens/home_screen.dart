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

  double _calculateConfidence(String code) {
    // Для тестирования: если в коде есть слово 'low', возвращаем низкую точность (50%)
    if (code.toLowerCase().contains('low')) {
      return 0.5;
    }
    return 0.95; // По умолчанию высокая точность
  }

  Future<bool> _showConfidenceWarning() async {
    return await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Внимание'),
          content: const Text('Проверьте сканирование, результат не надёжен'),
          actions: <Widget>[
            TextButton(
              child: const Text('Отмена'),
              onPressed: () {
                Navigator.of(context).pop(false);
              },
            ),
            ElevatedButton(
              child: const Text('Продолжить'),
              onPressed: () {
                Navigator.of(context).pop(true);
              },
            ),
          ],
        );
      },
    ) ?? false;
  }

  void _onDetect(BarcodeCapture capture) async {
    if (_isScanning) return;
    
    final List<Barcode> barcodes = capture.barcodes;
    if (barcodes.isNotEmpty) {
      final String? code = barcodes.first.rawValue;
      if (code != null) {
        setState(() => _isScanning = true);

        // Проверяем точность распознавания
        final confidence = _calculateConfidence(code);
        if (confidence < 0.70) {
          final proceed = await _showConfidenceWarning();
          if (!proceed) {
            setState(() => _isScanning = false);
            return;
          }
        }
        
        try {
          // Отправка на бекенд
          await ApiService().scanBarcode(code);
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Сканировано: $code')),
          );
        } catch (e) {
          // Сохранение в локальном хранилище (офлайн-очереди)
          await OfflineQueue().enqueueRequest('/medication/scan', {'barcode': code});
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Оффлайн. Сканирование добавлено в очередь: $code')),
          );
        }

        // Задержка перед следующим сканированием
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
