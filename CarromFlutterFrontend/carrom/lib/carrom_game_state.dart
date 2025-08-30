import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import './carrom_player.dart';

const String relayAddress = 'ws://192.168.1.203:4000';

class CarromGameState extends ChangeNotifier {
  WebSocketChannel? _channel;

  bool isConnected = false;
  bool isInRoom = false;
  String? roomId;
  String? sessionId;
  String playerName = '';
  String uniqueId = '';
  String matchOptionId = '9982929010dsx';
  bool useBonus = false;
  String userId = 'YashKiller';

  Map<String, CarromPlayer> players = {};
  String currentTurn = '';
  bool gameStarted = false;
  bool gameEnded = false;
  String winner = '';
  String lastMessage = '';

  void connectToRelay() {
    try {
      _channel = WebSocketChannel.connect(Uri.parse(relayAddress));
      _channel!.stream.listen(
        (msg) {
          print('🛰 🙌🙌 Received: $msg');
          _handleMessage(msg);
        },
        onDone: () => _handleDisconnection(),
        onError: (e) => _handleError(e),
      );

      isConnected = true;
      notifyListeners();
    } catch (e) {
      lastMessage = '❌ Failed to connect: $e';
      isConnected = false;
      notifyListeners();
    }
  }

  void joinRoom() {
    if (!isConnected) return;

    final joinPayload = {
      'type': 'join',
      'data': {
        'name': "yash",
        'uniqueId': "1749703909450",
        'matchOptionId': "684bf9e16f5197dae4e38715",
        'useBonus': useBonus,
        'gameWidth': 800,
        'gameHeight': 600,
        'userId': "Yash_23",
      },
    };

    _channel!.sink.add(jsonEncode(joinPayload));
    print('📤 Sent join request');
  }

  void sendAction(String type, Map<String, dynamic> data) {
    if (_channel == null) return;
    final msg = jsonEncode({'type': type, 'data': data});
    _channel!.sink.add(msg);
    print('📤 Sent: $type');
  }

  void _handleMessage(String message) {
    try {
      final parsed = jsonDecode(message);
      final type = parsed['type'];
      final data = parsed['data'];

      switch (type) {
        case 'joined':
          isInRoom = true;
          roomId = data['roomId'];
          sessionId = data['sessionId'];
          lastMessage = '✅ Joined room: $roomId';

          sendAction('join_game', {});
          break;

        case 'state':
          currentTurn = data['currentTurn'] ?? '';
          gameStarted = data['gameStarted'] ?? false;
          gameEnded = data['gameEnded'] ?? false;
          winner = data['winner'] ?? '';
          if (data['players'] != null) {
            players = Map.fromEntries(
              (data['players'] as Map).entries.map((e) {
                return MapEntry(e.key, CarromPlayer.fromJson(e.value));
              }),
            );
          }
          break;

        case 'turnChange':
          currentTurn = data['sessionId'];
          break;

        case 'gameStart':
          gameStarted = true;
          break;

        case 'gameOver':
          gameEnded = true;
          winner = data['winner'] ?? '';
          break;

        case 'error':
          lastMessage = '⚠ Error: ${data.toString()}';
          break;

        default:
          lastMessage = '📩 Unknown message: $type';
          break;
      }

      notifyListeners();
    } catch (e) {
      lastMessage = '❌ Error decoding message: $e';
      notifyListeners();
    }
  }

  void _handleDisconnection() {
    isConnected = false;
    isInRoom = false;
    lastMessage = '🔌 Disconnected';
    notifyListeners();
  }

  void _handleError(error) {
    isConnected = false;
    lastMessage = '❌ Connection error: $error';
    notifyListeners();
  }

  void disconnect() {
    _channel?.sink.close();
    _channel = null;
    isConnected = false;
    isInRoom = false;
    notifyListeners();
  }


  void shoot({required double dragStartX, required double dragStartY, required double dragEndX, required double dragEndY, required double power}) {
    sendAction("shoot", {
      "dragStart": {"x": dragStartX, "y": dragStartY},
      "dragEnd": {"x": dragEndX, "y": dragEndY},
      "power": power,
    });
  }

  void moveStriker(double x) {
    sendAction("moveStriker", {"x": x});
  }

  void requestRematch() {
    sendAction("rematch", {});
  }

  void playReady() {
    sendAction("playReady", {});
  }
}

