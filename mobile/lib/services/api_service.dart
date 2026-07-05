import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
      onError: (DioException e, handler) {
        if (e.response?.statusCode == 401) {
          // Handle unauthorized
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
    return await dio.post('/inventory/scan', data: {
      'barcode': barcode,
    });
  }

  static Future<Response> get(String path) async {
    return await ApiService().dio.get(path);
  }

  static Future<Response> post(String path, dynamic data) async {
    return await ApiService().dio.post(path, data: data);
  }
}
