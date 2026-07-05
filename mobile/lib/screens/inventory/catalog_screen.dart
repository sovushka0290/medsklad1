import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import 'package:google_fonts/google_fonts.dart';

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> with SingleTickerProviderStateMixin {
  bool _isLoading = true;
  List<dynamic> _inventory = [];

  @override
  void initState() {
    super.initState();
    _loadInventory();
  }

  Future<void> _loadInventory() async {
    setState(() => _isLoading = true);
    try {
      final response = await ApiService.get('/inventory');
      setState(() {
        _inventory = response.data['data'] ?? [];
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Ошибка загрузки: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Каталог остатков'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadInventory,
          )
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _inventory.isEmpty
              ? Center(
                  child: Text(
                    'Склад пуст',
                    style: GoogleFonts.inter(fontSize: 16, color: Colors.grey),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.only(top: 8, bottom: 24),
                  itemCount: _inventory.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 4),
                  itemBuilder: (context, index) {
                    final item = _inventory[index];
                    final med = item['medication'] ?? {};
                    final loc = item['location'] ?? {};
                    final String name = med['name'] ?? 'Неизвестно';
                    final String locationName = loc['name'] ?? 'N/A';
                    final String? expDateRaw = item['expirationDate'];
                    
                    bool isExpiring = false;
                    if (expDateRaw != null) {
                      final expDate = DateTime.parse(expDateRaw);
                      final diff = expDate.difference(DateTime.now()).inDays;
                      isExpiring = diff < 30; // 30 days threshold
                    }

                    return Container(
                      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                      decoration: BoxDecoration(
                        color: Theme.of(context).cardTheme.color,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.04),
                            blurRadius: 10,
                            offset: const Offset(0, 4),
                          )
                        ],
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            // Icon container
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Theme.of(context).primaryColor.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Icon(Icons.medication, color: Theme.of(context).primaryColor),
                            ),
                            const SizedBox(width: 16),
                            // Details
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    name,
                                    style: GoogleFonts.inter(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 16,
                                      color: const Color(0xFF0F172A),
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      Icon(Icons.location_on_outlined, size: 14, color: Colors.grey[600]),
                                      const SizedBox(width: 4),
                                      Text(
                                        locationName,
                                        style: GoogleFonts.inter(fontSize: 13, color: Colors.grey[700]),
                                      ),
                                    ],
                                  ),
                                  if (item['serialNumber'] != null) ...[
                                    const SizedBox(height: 4),
                                    Text('Серия: ${item['serialNumber']}',
                                        style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[500])),
                                  ],
                                  const SizedBox(height: 12),
                                  // Chips row
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: Theme.of(context).primaryColor.withOpacity(0.1),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Text(
                                          '${item['quantity']} шт',
                                          style: GoogleFonts.inter(
                                            fontWeight: FontWeight.w600,
                                            color: Theme.of(context).primaryColor,
                                            fontSize: 13,
                                          ),
                                        ),
                                      ),
                                      if (expDateRaw != null)
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: isExpiring ? Colors.red.withOpacity(0.1) : Colors.green.withOpacity(0.1),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Row(
                                            children: [
                                              Icon(isExpiring ? Icons.warning_amber_rounded : Icons.check_circle_outline, 
                                                size: 14, 
                                                color: isExpiring ? Colors.red[700] : Colors.green[700]
                                              ),
                                              const SizedBox(width: 4),
                                              Text(
                                                expDateRaw.split('T')[0],
                                                style: GoogleFonts.inter(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w600,
                                                  color: isExpiring ? Colors.red[700] : Colors.green[700],
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                    ],
                                  )
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
