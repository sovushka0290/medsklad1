import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../services/offline_queue.dart';
import 'package:google_fonts/google_fonts.dart';

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
                        suffixIcon: IconButton(
                          icon: Icon(Icons.qr_code_scanner_rounded, color: Theme.of(context).primaryColor),
                          onPressed: () {
                            // TODO: Open Scanner Logic
                          },
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
                child: ElevatedButton(
                  onPressed: _isLoading ? null : _submitTransaction,
                  child: _isLoading 
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Провести транзакцию'),
                ),
              )
            ],
          ),
        ),
      ),
    );
  }
}
