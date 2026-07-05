import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/offline_queue.dart';
import 'package:google_fonts/google_fonts.dart';

class ProcedureScreen extends StatefulWidget {
  const ProcedureScreen({super.key});

  @override
  State<ProcedureScreen> createState() => _ProcedureScreenState();
}

class _ProcedureScreenState extends State<ProcedureScreen> {
  final _formKey = GlobalKey<FormState>();
  List<dynamic> _procedures = [];
  List<dynamic> _locations = [];
  String? _selectedProcedureId;
  String? _selectedLocationId;
  bool _isLoading = false;
  bool _isSubmitLoading = false;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    try {
      final responses = await Future.wait([
        ApiService.get('/procedures'),
        ApiService.get('/locations'),
      ]);
      
      setState(() {
        _procedures = responses[0].data['data'] ?? [];
        _locations = responses[1].data ?? [];
        
        if (_procedures.isNotEmpty) {
          _selectedProcedureId = _procedures.first['id'].toString();
        }
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
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _submitProcedure() async {
    if (!_formKey.currentState!.validate() || _selectedProcedureId == null || _selectedLocationId == null) return;
    setState(() => _isSubmitLoading = true);

    final payload = {
      'procedureId': int.parse(_selectedProcedureId!),
      'locationId': int.parse(_selectedLocationId!),
    };

    try {
      try {
        await ApiService.post('/procedures/log', payload);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Процедура успешно проведена, материалы списаны'),
            backgroundColor: Colors.green,
          ));
        }
      } catch (e) {
        await OfflineQueue().enqueueRequest('/procedures/log', payload);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Сеть недоступна. Сохранено в оффлайн-очередь.'),
            backgroundColor: Colors.orange,
          ));
        }
      }
    } finally {
      if (mounted) setState(() => _isSubmitLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Списание по процедуре'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadInitialData,
          )
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Проведение лечения',
                      style: GoogleFonts.inter(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Списание медикаментов произойдет автоматически согласно нормам процедуры (по принципу FEFO)',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: Colors.grey[600],
                      ),
                    ),
                    const SizedBox(height: 24),
                    // Form Container
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
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Procedure dropdown
                          DropdownButtonFormField<String>(
                            value: _selectedProcedureId,
                            icon: const Icon(Icons.keyboard_arrow_down_rounded),
                            decoration: const InputDecoration(
                              labelText: 'Выберите процедуру',
                              border: OutlineInputBorder(),
                            ),
                            style: GoogleFonts.inter(fontSize: 16, color: const Color(0xFF0F172A)),
                            items: _procedures.map<DropdownMenuItem<String>>((proc) {
                              return DropdownMenuItem<String>(
                                value: proc['id'].toString(),
                                child: Text(proc['name'] ?? 'Неизвестно'),
                              );
                            }).toList(),
                            onChanged: (val) => setState(() => _selectedProcedureId = val),
                          ),
                          const SizedBox(height: 20),
                          
                          // Location (cabinet) dropdown
                          DropdownButtonFormField<String>(
                            value: _selectedLocationId,
                            icon: const Icon(Icons.keyboard_arrow_down_rounded),
                            decoration: const InputDecoration(
                              labelText: 'Кабинет / Место проведения',
                              border: OutlineInputBorder(),
                            ),
                            style: GoogleFonts.inter(fontSize: 16, color: const Color(0xFF0F172A)),
                            items: _locations.map<DropdownMenuItem<String>>((loc) {
                              return DropdownMenuItem<String>(
                                value: loc['id'].toString(),
                                child: Text(loc['name'] ?? 'Неизвестно'),
                              );
                            }).toList(),
                            onChanged: (val) => setState(() => _selectedLocationId = val),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 32),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        onPressed: _isSubmitLoading ? null : _submitProcedure,
                        child: _isSubmitLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('Списать медикаменты'),
                      ),
                    )
                  ],
                ),
              ),
            ),
    );
  }
}
