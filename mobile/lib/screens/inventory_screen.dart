import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/offline_queue.dart';
import 'package:google_fonts/google_fonts.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  List<dynamic> _activeSessions = [];
  List<dynamic> _locations = [];
  bool _isLoading = false;
  String? _selectedLocationId;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final activeRes = await ApiService.get('/inventory/active');
      final locRes = await ApiService.get('/locations');
      setState(() {
        _activeSessions = activeRes.data ?? [];
        _locations = locRes.data ?? [];
        if (_locations.isNotEmpty) {
          _selectedLocationId = _locations.first['id'].toString();
        }
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Ошибка загрузки данных: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _startSession() async {
    if (_selectedLocationId == null) return;
    setState(() => _isLoading = true);
    try {
      await ApiService().startInventory(int.parse(_selectedLocationId!));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Инвентаризационная сессия успешно начата'), backgroundColor: Colors.green),
        );
      }
      _loadData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Ошибка создания сессии: $e')),
        );
      }
      setState(() => _isLoading = false);
    }
  }

  Future<void> _closeSession(int sessionId) async {
    setState(() => _isLoading = true);
    try {
      try {
        await ApiService().closeInventory(sessionId);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Сессия успешно закрыта'), backgroundColor: Colors.green),
          );
        }
      } catch (e) {
        await OfflineQueue().enqueueRequest('/inventory/$sessionId/close', {});
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Сеть недоступна. Запрос сохранен оффлайн.'), backgroundColor: Colors.orange),
          );
        }
      }
      _loadData();
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showAdjustDialog(int sessionId) {
    final barcodeController = TextEditingController();
    final adjustmentController = TextEditingController(text: '1');
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Корректировка'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: barcodeController,
                decoration: const InputDecoration(labelText: 'Штрихкод медикамента'),
                keyboardType: TextInputType.text,
              ),
              const SizedBox(height: 10),
              TextField(
                controller: adjustmentController,
                decoration: const InputDecoration(labelText: 'Корректировка количества (+/-)'),
                keyboardType: TextInputType.number,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Отмена'),
            ),
            ElevatedButton(
              onPressed: () async {
                final barcode = barcodeController.text.trim();
                final adj = int.tryParse(adjustmentController.text) ?? 0;
                if (barcode.isEmpty) return;
                Navigator.pop(ctx);
                setState(() => _isLoading = true);
                try {
                  try {
                    await ApiService().adjustItemQuantity(sessionId, barcode, adj);
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Количество успешно скорректировано'), backgroundColor: Colors.green),
                      );
                    }
                  } catch (e) {
                    await OfflineQueue().enqueueRequest('/inventory/$sessionId/adjust', {
                      'barcode': barcode,
                      'quantityAdjustment': adj,
                    });
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Оффлайн. Сохранено для синхронизации.'), backgroundColor: Colors.orange),
                      );
                    }
                  }
                  _loadData();
                } finally {
                  if (mounted) setState(() => _isLoading = false);
                }
              },
              child: const Text('Сохранить'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Инвентаризация'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
          )
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Новая проверка',
                    style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: _selectedLocationId,
                          items: _locations.map<DropdownMenuItem<String>>((loc) {
                            return DropdownMenuItem<String>(
                              value: loc['id'].toString(),
                              child: Text(loc['name'] ?? ''),
                            );
                          }).toList(),
                          onChanged: (val) => setState(() => _selectedLocationId = val),
                          decoration: const InputDecoration(
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      ElevatedButton(
                        onPressed: _startSession,
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                        ),
                        child: const Text('Открыть'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Активные сессии',
                    style: GoogleFonts.inter(fontSize: 20, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  Expanded(
                    child: _activeSessions.isEmpty
                        ? const Center(child: Text('Нет активных проверок'))
                        : ListView.builder(
                            itemCount: _activeSessions.length,
                            itemBuilder: (context, index) {
                              final session = _activeSessions[index];
                              return Card(
                                margin: const EdgeInsets.only(bottom: 12),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                                child: Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        session['location']['name'] ?? 'Кабинет',
                                        style: GoogleFonts.inter(fontSize: 18, fontWeight: FontWeight.bold),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Создана: ${session['createdAt'] != null ? DateTime.parse(session['createdAt']).toLocal().toString().substring(0, 16) : ''}',
                                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                                      ),
                                      const SizedBox(height: 16),
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.end,
                                        children: [
                                          TextButton.icon(
                                            icon: const Icon(Icons.edit, size: 16),
                                            label: const Text('Корректировать'),
                                            onPressed: () => _showAdjustDialog(session['id']),
                                          ),
                                          const SizedBox(width: 8),
                                          ElevatedButton.icon(
                                            icon: const Icon(Icons.check, size: 16),
                                            label: const Text('Завершить'),
                                            onPressed: () => _closeSession(session['id']),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.emerald,
                                              foregroundColor: Colors.white,
                                            ),
                                          ),
                                        ],
                                      )
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                  )
                ],
              ),
            ),
    );
  }
}
