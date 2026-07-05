import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../services/offline_queue.dart';
import '../../theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:convert';

class OperationScreen extends StatefulWidget {
  const OperationScreen({super.key});

  @override
  State<OperationScreen> createState() => _OperationScreenState();
}

class _OperationScreenState extends State<OperationScreen> {
  final _formKey = GlobalKey<FormState>();
  String _type = 'INCOME';
  final _quantityController = TextEditingController();
  final _medicationIdController = TextEditingController();
  final _locationIdController = TextEditingController();
  bool _isLoading = false;
  final ImagePicker _picker = ImagePicker();

  Future<void> _scanWithAI() async {
    try {
      final XFile? image = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 70);
      if (image == null) return;

      setState(() => _isLoading = true);
      final bytes = await image.readAsBytes();
      final base64Img = base64Encode(bytes);

      final response = await ApiService().recognizeImage(base64Img);
      
      if (response.data != null) {
        final double confidence = (response.data['confidence'] as num?)?.toDouble() ?? 0.0;
        final String name = response.data['name'] ?? '';

        if (mounted) {
          if (confidence < 80) {
            showDialog(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Внимание'),
                content: Text('Низкая уверенность распознавания ($confidence%).\\nИИ предположил: $name.\\nПожалуйста, введите данные вручную.'),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: const Text('Понятно'),
                  ),
                ],
              ),
            );
          } else {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text('Успешно распознано: $name ($confidence%)'),
              backgroundColor: Colors.green,
            ));
            // You can auto-fill ID if you map name to ID here
          }
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Ошибка распознавания'),
          backgroundColor: Colors.red,
        ));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _submitTransaction() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);

    try {
      final payload = {
        'type': _type,
        'quantity': int.parse(_quantityController.text),
        'medicationId': int.parse(_medicationIdController.text),
        'locationId': int.parse(_locationIdController.text),
      };

      try {
        await ApiService.post('/transactions', payload);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Транзакция успешно проведена'),
            backgroundColor: Colors.green,
          ));
        }
      } catch (e) {
        await OfflineQueue().enqueueRequest('/transactions', payload);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Нет сети. Сохранено локально.'),
            backgroundColor: Colors.orange,
          ));
        }
      }

      _quantityController.clear();
      _medicationIdController.clear();
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Операция со складом'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Заполните форму',
                style: GoogleFonts.inter(
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF0F172A),
                ),
              ),
              const SizedBox(height: 24),
              // Card for Form
              Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.04),
                      blurRadius: 15,
                      offset: const Offset(0, 8),
                    )
                  ],
                ),
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    DropdownButtonFormField<String>(
                      value: _type,
                      icon: const Icon(Icons.keyboard_arrow_down_rounded),
                      decoration: const InputDecoration(labelText: 'Тип операции'),
                      style: GoogleFonts.inter(fontSize: 16, color: const Color(0xFF0F172A)),
                      items: const [
                        DropdownMenuItem(value: 'INCOME', child: Text('Приход')),
                        DropdownMenuItem(value: 'OUTFLOW', child: Text('Расход')),
                        DropdownMenuItem(value: 'WRITE_OFF', child: Text('Списание')),
                      ],
                      onChanged: (val) => setState(() => _type = val!),
                    ),
                    const SizedBox(height: 20),
                    TextFormField(
                      controller: _medicationIdController,
                      decoration: InputDecoration(
                        labelText: 'ID медикамента',
                        suffixIcon: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: Icon(Icons.document_scanner, color: Theme.of(context).primaryColor),
                              tooltip: 'Распознать через ИИ',
                              onPressed: _scanWithAI,
                            ),
                            IconButton(
                              icon: Icon(Icons.qr_code_scanner_rounded, color: Theme.of(context).primaryColor),
                              onPressed: () {
                                // TODO: Open Scanner Logic
                              },
                            ),
                          ],
                        ),
                      ),
                      keyboardType: TextInputType.number,
                      validator: (val) => val!.isEmpty ? 'Обязательно' : null,
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _locationIdController,
                            decoration: const InputDecoration(labelText: 'ID Локации'),
                            keyboardType: TextInputType.number,
                            validator: (val) => val!.isEmpty ? 'Обязательно' : null,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: TextFormField(
                            controller: _quantityController,
                            decoration: const InputDecoration(labelText: 'Кол-во'),
                            keyboardType: TextInputType.number,
                            validator: (val) => val!.isEmpty ? 'Обязательно' : null,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  transitionBuilder: (Widget child, Animation<double> animation) {
                    return FadeTransition(opacity: animation, child: ScaleTransition(scale: animation, child: child));
                  },
                  child: _isLoading
                      ? const Padding(
                          padding: EdgeInsets.symmetric(vertical: 14),
                          child: SizedBox(
                            height: 24, 
                            width: 24, 
                            child: CircularProgressIndicator(color: AppTheme.primaryColor, strokeWidth: 3)
                          ),
                        )
                      : ElevatedButton(
                          key: const ValueKey('submitBtn'),
                          onPressed: _submitTransaction,
                          child: const Text('Провести транзакцию'),
                        ),
                ),
              )
            ],
          ),
        ),
      ),
    );
  }
}
