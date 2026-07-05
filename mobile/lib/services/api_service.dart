import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'offline_queue.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  late Dio dio;

  factory ApiService() {
    return _instance;
  }

  ApiService._internal() {
    dio = Dio(BaseOptions(
      baseUrl: 'http://10.0.2.2:3000/api', // Android Emulator to localhost
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
    ));

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final prefs = await SharedPreferences.getInstance();
        final token = prefs.getString('token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (DioException e, handler) async {
        if (e.response?.statusCode == 401) {
          // Handle unauthorized
        }

        // Handle network errors for mutation requests
        if (e.type == DioExceptionType.connectionTimeout ||
            e.type == DioExceptionType.receiveTimeout ||
            e.type == DioExceptionType.connectionError ||
            e.type == DioExceptionType.unknown) {
          final options = e.requestOptions;
          if (options.method.toUpperCase() != 'GET') {
            await OfflineQueue().enqueueRequest(options.path, options.data ?? {});
            // Return a fake success response to prevent UI from breaking
            return handler.resolve(Response(
              requestOptions: options,
              statusCode: 202, // Accepted
              statusMessage: 'Saved offline',
              data: {'message': 'Request saved offline for later sync'},
            ));
          }
        }

        return handler.next(e);
      }
    ));
  }

  Future<Response> login(String email, String password) async {
    return await dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
  }

  Future<Response> scanBarcode(String barcode) async {
    return await dio.post('/medication/scan', data: {
      'barcode': barcode,
    });
  }

  Future<Response> recognizeImage(String base64Image) async {
    return await dio.post('/ai/recognize', data: {
      'base64Image': base64Image,
      'mimeType': 'image/jpeg',
    });
  }

  Future<Response> fetchDashboardMetrics(String filter, {String? startDate, String? endDate}) async {
    String path = '/dashboard/metrics?filter=$filter';
    if (startDate != null && endDate != null) {
      path += '&startDate=$startDate&endDate=$endDate';
    }
    return await dio.get(path);
  }

  Future<Response> createMedication(Map<String, dynamic> data) async {
    return await dio.post('/medications', data: data);
  }

  Future<Response> startInventory(int locationId) async {
    return await dio.post('/inventory/start', data: {'locationId': locationId});
  }

  Future<Response> closeInventory(int sessionId) async {
    return await dio.post('/inventory/$sessionId/close');
  }

  Future<Response> adjustItemQuantity(int sessionId, String barcode, int quantityAdjustment) async {
    return await dio.post('/inventory/$sessionId/adjust', data: {
      'barcode': barcode,
      'quantityAdjustment': quantityAdjustment,
    });
  }

  Future<Response> getProceduresComparison() async {
    return await dio.get('/procedures/comparison');
  }

  static Future<Response> get(String path) async {
    return await ApiService().dio.get(path);
  }

  static Future<Response> post(String path, dynamic data) async {
    return await ApiService().dio.post(path, data: data);
  }
}
