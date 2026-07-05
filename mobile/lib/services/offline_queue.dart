import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import 'dart:convert';
import 'api_service.dart';

class OfflineQueue {
  static final OfflineQueue _instance = OfflineQueue._internal();
  Database? _db;

  factory OfflineQueue() {
    return _instance;
  }

  OfflineQueue._internal();

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _initDB();
    return _db!;
  }

  Future<Database> _initDB() async {
    String path = join(await getDatabasesPath(), 'offline_queue.db');
    return await openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE queue(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            endpoint TEXT,
            payload TEXT,
            createdAt TEXT
          )
        ''');
      },
    );
  }

  Future<void> enqueueRequest(String endpoint, Map<String, dynamic> payload) async {
    final db = await database;
    await db.transaction((txn) async {
      await txn.insert('queue', {
        'endpoint': endpoint,
        'payload': jsonEncode(payload),
        'createdAt': DateTime.now().toIso8601String(),
      });
    });
  }

  Future<void> syncQueue() async {
    final db = await database;
    final List<Map<String, dynamic>> items = await db.query('queue', orderBy: 'id ASC');
    
    if (items.isEmpty) return;

    final api = ApiService();
    final List<int> successfulIds = [];
    
    for (var item in items) {
      try {
        await api.dio.post(item['endpoint'], data: jsonDecode(item['payload']));
        successfulIds.add(item['id'] as int);
      } catch (e) {
        // Stop syncing on first failure to maintain order
        break;
      }
    }

    if (successfulIds.isNotEmpty) {
      final batch = db.batch();
      for (final id in successfulIds) {
        batch.delete('queue', where: 'id = ?', whereArgs: [id]);
      }
      await batch.commit(noResult: true);
    }
  }
}
