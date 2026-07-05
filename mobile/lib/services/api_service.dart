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
      onError: (DioException e, handler) async {
        if (e.response?.statusCode == 401 && 
            e.requestOptions.path != '/auth/login' && 
            e.requestOptions.path != '/auth/refresh') {
          
          final prefs = await SharedPreferences.getInstance();
          final refreshToken = prefs.getString('refreshToken');
          
          if (refreshToken != null) {
            try {
              // Используем отдельный инстанс Dio, чтобы избежать бесконечной рекурсии
              final refreshDio = Dio(BaseOptions(
                baseUrl: e.requestOptions.baseUrl,
                connectTimeout: const Duration(seconds: 5),
                receiveTimeout: const Duration(seconds: 5),
              ));

              final response = await refreshDio.post('/auth/refresh', data: {
                'refreshToken': refreshToken,
              });

              if (response.statusCode == 200 && response.data['success'] == true) {
                final responseData = response.data['data'];
                final newToken = responseData['token'];
                final newRefreshToken = responseData['refreshToken'];

                await prefs.setString('token', newToken);
                if (newRefreshToken != null) {
                  await prefs.setString('refreshToken', newRefreshToken);
                }

                // Клонируем исходный запрос и отправляем его снова с обновленным токеном
                final options = e.requestOptions;
                options.headers['Authorization'] = 'Bearer $newToken';

                final retryDio = Dio(BaseOptions(
                  baseUrl: options.baseUrl,
                  connectTimeout: options.connectTimeout,
                  receiveTimeout: options.receiveTimeout,
                  headers: options.headers,
                ));

                final clonedResponse = await retryDio.request(
                  options.path,
                  data: options.data,
                  queryParameters: options.queryParameters,
                  options: Options(method: options.method),
                );

                return handler.resolve(clonedResponse);
              }
            } catch (refreshError) {
              // Если рефреш токена завершился ошибкой, удаляем недействительные токены
              await prefs.remove('token');
              await prefs.remove('refreshToken');
            }
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

  static Future<Response> get(String path) async {
    return await ApiService().dio.get(path);
  }

  static Future<Response> post(String path, dynamic data) async {
    return await ApiService().dio.post(path, data: data);
  }
}
