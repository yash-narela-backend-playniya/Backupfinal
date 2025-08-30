// pubspec.yaml dependencies to add:
// web_socket_channel: ^2.4.0
// json_annotation: ^4.8.1
// json_serializable: ^6.7.1

import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

// Game Models
class CarromPiece {
  final String id;
  final String type;
  final double x;
  final double y;
  final double vx;
  final double vy;
  final double radius;
  final bool isActive;
  final bool isPocketed;

  CarromPiece({
    required this.id,
    required this.type,
    required this.x,
    required this.y,
    this.vx = 0.0,
    this.vy = 0.0,
    required this.radius,
    this.isActive = true,
    this.isPocketed = false,
  });

  factory CarromPiece.fromJson(Map<String, dynamic> json) {
    return CarromPiece(
      id: json['id'] ?? '',
      type: json['type'] ?? '',
      x: (json['x'] ?? 0).toDouble(),
      y: (json['y'] ?? 0).toDouble(),
      vx: (json['vx'] ?? 0).toDouble(),
      vy: (json['vy'] ?? 0).toDouble(),
      radius: (json['radius'] ?? 12).toDouble(),
      isActive: json['isActive'] ?? true,
      isPocketed: json['isPocketed'] ?? false,
    );
  }
}

class Player {
  final String sessionId;
  final String name;
  final int score;
  final int position;
  final bool isActive;
  final int timeRemaining;
  final int whitesPocketed;
  final int blacksPocketed;
  final bool hasQueen;
  final bool queenCovered;
  final int lives;
  final bool disqualified;
  final String uniqueId;
  final bool isReady;

  Player({
    required this.sessionId,
    required this.name,
    this.score = 0,
    required this.position,
    this.isActive = false,
    this.timeRemaining = 10,
    this.whitesPocketed = 0,
    this.blacksPocketed = 0,
    this.hasQueen = false,
    this.queenCovered = false,
    this.lives = 3,
    this.disqualified = false,
    required this.uniqueId,
    this.isReady = false,
  });

  factory Player.fromJson(Map<String, dynamic> json) {
    return Player(
      sessionId: json['sessionId'] ?? '',
      name: json['name'] ?? '',
      score: json['score'] ?? 0,
      position: json['position'] ?? 0,
      isActive: json['isActive'] ?? false,
      timeRemaining: json['timeRemaining'] ?? 10,
      whitesPocketed: json['whitesPocketed'] ?? 0,
      blacksPocketed: json['blacksPocketed'] ?? 0,
      hasQueen: json['hasQueen'] ?? false,
      queenCovered: json['queenCovered'] ?? false,
      lives: json['lives'] ?? 3,
      disqualified: json['disqualified'] ?? false,
      uniqueId: json['uniqueId'] ?? '',
      isReady: json['isReady'] ?? false,
    );
  }
}

class GameEvent {
  final String type;
  final String playerId;
  final String? pieceType;
  final int? points;
  final String? message;
  final int timestamp;

  GameEvent({
    required this.type,
    required this.playerId,
    this.pieceType,
    this.points,
    this.message,
    required this.timestamp,
  });

  factory GameEvent.fromJson(Map<String, dynamic> json) {
    return GameEvent(
      type: json['type'] ?? '',
      playerId: json['playerId'] ?? '',
      pieceType: json['pieceType'],
      points: json['points'],
      message: json['message'],
      timestamp: json['timestamp'] ?? DateTime.now().millisecondsSinceEpoch,
    );
  }
}

class CarromGameState {
  final int currentPlayerIndex;
  final int gameTimeRemaining;
  final bool isGameStarted;
  final bool isGameOver;
  final String gameStatus;
  final int turnTimeRemaining;
  final bool isPaused;
  final String? winner;
  final int totalPlayers;
  final String matchOptionId;
  final int minPlayer;
  final int betAmount;
  final int winAmount;
  final Map<String, Player> players;
  final Map<String, CarromPiece> pieces;
  final List<GameEvent> events;
  final Map<String, bool> playReady;
  final bool countdownStarted;
  final int countdown;

  CarromGameState({
    this.currentPlayerIndex = 0,
    this.gameTimeRemaining = 300,
    this.isGameStarted = false,
    this.isGameOver = false,
    this.gameStatus = "waiting",
    this.turnTimeRemaining = 10,
    this.isPaused = false,
    this.winner,
    this.totalPlayers = 0,
    this.matchOptionId = "",
    this.minPlayer = 2,
    this.betAmount = 0,
    this.winAmount = 0,
    this.players = const {},
    this.pieces = const {},
    this.events = const [],
    this.playReady = const {},
    this.countdownStarted = false,
    this.countdown = 10,
  });

  factory CarromGameState.fromJson(Map<String, dynamic> json) {
    Map<String, Player> players = {};
    if (json['players'] != null) {
      (json['players'] as Map<String, dynamic>).forEach((key, value) {
        players[key] = Player.fromJson(value);
      });
    }

    Map<String, CarromPiece> pieces = {};
    if (json['pieces'] != null) {
      (json['pieces'] as Map<String, dynamic>).forEach((key, value) {
        pieces[key] = CarromPiece.fromJson(value);
      });
    }

    List<GameEvent> events = [];
    if (json['events'] != null) {
      events = (json['events'] as List)
          .map((e) => GameEvent.fromJson(e))
          .toList();
    }

    Map<String, bool> playReady = {};
    if (json['playReady'] != null) {
      (json['playReady'] as Map<String, dynamic>).forEach((key, value) {
        playReady[key] = value ?? false;
      });
    }

    return CarromGameState(
      currentPlayerIndex: json['currentPlayerIndex'] ?? 0,
      gameTimeRemaining: json['gameTimeRemaining'] ?? 300,
      isGameStarted: json['isGameStarted'] ?? false,
      isGameOver: json['isGameOver'] ?? false,
      gameStatus: json['gamestatus'] ?? "waiting",
      turnTimeRemaining: json['turnTimeRemaining'] ?? 10,
      isPaused: json['isPaused'] ?? false,
      winner: json['winner'],
      totalPlayers: json['totalPlayers'] ?? 0,
      matchOptionId: json['matchOptionId'] ?? "",
      minPlayer: json['minPlayer'] ?? 2,
      betAmount: json['betAmount'] ?? 0,
      winAmount: json['winAmount'] ?? 0,
      players: players,
      pieces: pieces,
      events: events,
      playReady: playReady,
      countdownStarted: json['countdownStarted'] ?? false,
      countdown: json['countdown'] ?? 10,
    );
  }
}

// WebSocket Service for Carrom Game
class CarromWebSocketService {
  static const String _wsUrl = 'ws://localhost:4000'; // Your relay server
  
  WebSocketChannel? _channel;
  final StreamController<CarromGameState> _gameStateController = 
      StreamController<CarromGameState>.broadcast();
  final StreamController<Map<String, dynamic>> _messageController = 
      StreamController<Map<String, dynamic>>.broadcast();
  
  CarromGameState? _currentState;
  String? _roomId;
  String? _sessionId;

  // Getters
  Stream<CarromGameState> get gameStateStream => _gameStateController.stream;
  Stream<Map<String, dynamic>> get messageStream => _messageController.stream;
  CarromGameState? get currentState => _currentState;
  String? get roomId => _roomId;
  String? get sessionId => _sessionId;
  bool get isConnected => _channel != null;

  // Connect and Join Game
  Future<void> joinGame({
    required String playerName,
    required String matchOptionId,
    required String uniqueId,
    required String userId,
    bool useBonus = false,
    int gameWidth = 800,
    int gameHeight = 600,
  }) async {
    try {
      _channel = WebSocketChannel.connect(Uri.parse(_wsUrl));
      
      // Listen to messages
      _channel!.stream.listen(
        _handleMessage,
        onDone: _handleDisconnection,
        onError: _handleError,
      );

      // Send join request
      final joinMessage = {
        'type': 'join',
        'data': {
          'roomName': 'carrom_game',
          'name': playerName,
          'matchOptionId': matchOptionId,
          'uniqueId': uniqueId,
          'userId': userId,
          'useBonus': useBonus,
          'gameWidth': gameWidth,
          'gameHeight': gameHeight,
        }
      };

      _sendMessage(joinMessage);
    } catch (e) {
      throw Exception('Failed to connect: $e');
    }
  }

  // Game Actions
  void markReady() {
    _sendMessage({'type': 'playReady', 'data': {}});
  }

  void shootStriker({
    required Offset dragStart,
    required Offset dragEnd,
    required double power,
  }) {
    _sendMessage({
      'type': 'shoot',
      'data': {
        'dragStart': {'x': dragStart.dx, 'y': dragStart.dy},
        'dragEnd': {'x': dragEnd.dx, 'y': dragEnd.dy},
        'power': power,
      }
    });
  }

  void moveStriker(double x) {
    _sendMessage({
      'type': 'moveStriker',
      'data': {'x': x}
    });
  }

  void skipTurn() {
    _sendMessage({'type': 'skipTurn', 'data': {}});
  }

  void requestRematch() {
    _sendMessage({'type': 'rematch', 'data': {}});
  }

  void getMatchStatus() {
    _sendMessage({'type': 'match_status', 'data': {}});
  }

  void exitGame() {
    _sendMessage({'type': 'exit', 'data': {}});
  }

  // Private Methods
  void _sendMessage(Map<String, dynamic> message) {
    if (_channel != null) {
      _channel!.sink.add(jsonEncode(message));
    }
  }

  void _handleMessage(dynamic message) {
    try {
      final Map<String, dynamic> data = jsonDecode(message);
      final String type = data['type'] ?? '';
      final dynamic messageData = data['data'];

      switch (type) {
        case 'joined':
          _roomId = messageData['roomId'];
          _sessionId = messageData['sessionId'];
          print('✅ Joined room: $_roomId');
          break;

        case 'state':
        case 'current_status':
          _currentState = CarromGameState.fromJson(messageData);
          _gameStateController.add(_currentState!);
          break;

        case 'error':
          print('❌ Error: $messageData');
          _messageController.add({'type': 'error', 'message': messageData});
          break;

        case 'gameStart':
        case 'gameOver':
        case 'countdown':
        case 'turnChange':
        case 'shot':
        case 'pocketed':
        case 'foul':
        case 'continueTurn':
        case 'strikerBlocked':
        case 'queenCovered':
        case 'queenPocketed':
        case 'rematch_possible':
        case 'rematch_reset':
          _messageController.add({
            'type': type,
            'data': messageData,
          });
          break;

        case 'left':
          print('👋 Left room with code: ${messageData['code']}');
          _handleDisconnection();
          break;

        default:
          print('🔄 Unhandled message type: $type');
          _messageController.add({
            'type': type,
            'data': messageData,
          });
      }
    } catch (e) {
      print('⚠️ Error parsing message: $e');
    }
  }

  void _handleDisconnection() {
    print('🔌 WebSocket disconnected');
    _channel = null;
    _roomId = null;
    _sessionId = null;
    _messageController.add({'type': 'disconnected'});
  }

  void _handleError(dynamic error) {
    print('⚠️ WebSocket error: $error');
    _messageController.add({'type': 'error', 'message': error.toString()});
  }

  // Cleanup
  void dispose() {
    _channel?.sink.close();
    _gameStateController.close();
    _messageController.close();
  }
}

// Example Usage Widget
class CarromGameScreen extends StatefulWidget {
  final String playerName;
  final String matchOptionId;
  final String uniqueId;
  final String userId;

  const CarromGameScreen({
    Key? key,
    required this.playerName,
    required this.matchOptionId,
    required this.uniqueId,
    required this.userId,
  }) : super(key: key);

  @override
  State<CarromGameScreen> createState() => _CarromGameScreenState();
}

class _CarromGameScreenState extends State<CarromGameScreen> {
  final CarromWebSocketService _wsService = CarromWebSocketService();
  CarromGameState? _gameState;
  String _statusMessage = 'Connecting...';

  @override
  void initState() {
    super.initState();
    _initializeGame();
  }

  Future<void> _initializeGame() async {
    // Listen to game state updates
    _wsService.gameStateStream.listen((state) {
      setState(() {
        _gameState = state;
        _updateStatusMessage(state);
      });
    });

    // Listen to game messages
    _wsService.messageStream.listen((message) {
      _handleGameMessage(message);
    });

    // Join the game
    try {
      await _wsService.joinGame(
        playerName: widget.playerName,
        matchOptionId: widget.matchOptionId,
        uniqueId: widget.uniqueId,
        userId: widget.userId,
        useBonus: false,
      );
    } catch (e) {
      setState(() {
        _statusMessage = 'Failed to connect: $e';
      });
    }
  }

  void _updateStatusMessage(CarromGameState state) {
    if (!state.isGameStarted) {
      if (state.countdownStarted) {
        _statusMessage = 'Game starting in ${state.countdown}...';
      } else {
        _statusMessage = 'Waiting for players (${state.totalPlayers}/${state.minPlayer})';
      }
    } else if (state.isGameOver) {
      final winner = state.players[state.winner];
      _statusMessage = winner != null 
          ? '🏆 ${winner.name} wins!' 
          : 'Game Over';
    } else {
      final currentPlayer = state.players.values
          .where((p) => p.position == state.currentPlayerIndex)
          .firstOrNull;
      _statusMessage = currentPlayer != null 
          ? '${currentPlayer.name}\'s turn (${state.turnTimeRemaining}s)'
          : 'Game in progress';
    }
  }

  void _handleGameMessage(Map<String, dynamic> message) {
    final type = message['type'];
    final data = message['data'];
    
    switch (type) {
      case 'error':
        _showSnackBar('Error: ${message['message']}', Colors.red);
        break;
      case 'shot':
        _showSnackBar('${data['message']}', Colors.blue);
        break;
      case 'pocketed':
        _showSnackBar('${data['message']} (+${data['points']} pts)', Colors.green);
        break;
      case 'foul':
        _showSnackBar('${data['message']} (${data['points']} pts)', Colors.orange);
        break;
      case 'gameStart':
        _showSnackBar('Game Started! Good luck!', Colors.green);
        break;
      case 'gameOver':
        _showSnackBar('${data['message']}', Colors.purple);
        break;
      case 'rematch_possible':
        _showRematchDialog();
        break;
    }
  }

  void _showSnackBar(String message, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: color,
        duration: Duration(seconds: 3),
      ),
    );
  }

  void _showRematchDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Game Over'),
        content: Text('Would you like to play again?'),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _wsService.exitGame();
              Navigator.of(context).pop();
            },
            child: Text('Exit'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              _wsService.requestRematch();
            },
            child: Text('Rematch'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Carrom Game'),
        backgroundColor: Colors.brown,
      ),
      body: Column(
        children: [
          // Status Bar
          Container(
            width: double.infinity,
            padding: EdgeInsets.all(16),
            color: Colors.brown.shade100,
            child: Text(
              _statusMessage,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),
          
          // Game Board
          Expanded(
            child: _gameState != null 
                ? CarromBoard(
                    gameState: _gameState!,
                    wsService: _wsService,
                  )
                : Center(child: CircularProgressIndicator()),
          ),
          
          // Control Panel
          if (_gameState != null) ...[
            CarromControlPanel(
              gameState: _gameState!,
              wsService: _wsService,
            ),
          ],
        ],
      ),
    );
  }

  @override
  void dispose() {
    _wsService.dispose();
    super.dispose();
  }
}

// Carrom Board Widget (Simplified)
class CarromBoard extends StatefulWidget {
  final CarromGameState gameState;
  final CarromWebSocketService wsService;

  const CarromBoard({
    Key? key,
    required this.gameState,
    required this.wsService,
  }) : super(key: key);

  @override
  State<CarromBoard> createState() => _CarromBoardState();
}

class _CarromBoardState extends State<CarromBoard> {
  Offset? _dragStart;
  Offset? _dragEnd;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.brown.shade300,
        border: Border.all(color: Colors.brown.shade800, width: 4),
        borderRadius: BorderRadius.circular(8),
      ),
      child: AspectRatio(
        aspectRatio: 1.0,
        child: GestureDetector(
          onPanStart: (details) {
            _dragStart = details.localPosition;
          },
          onPanUpdate: (details) {
            setState(() {
              _dragEnd = details.localPosition;
            });
          },
          onPanEnd: (details) {
            if (_dragStart != null && _dragEnd != null) {
              final distance = (_dragEnd! - _dragStart!).distance;
              final power = (distance * 0.5).clamp(0.0, 35.0);
              
              widget.wsService.shootStriker(
                dragStart: _dragStart!,
                dragEnd: _dragEnd!,
                power: power,
              );
            }
            
            setState(() {
              _dragStart = null;
              _dragEnd = null;
            });
          },
          child: CustomPaint(
            painter: CarromBoardPainter(
              gameState: widget.gameState,
              dragStart: _dragStart,
              dragEnd: _dragEnd,
            ),
            size: Size.infinite,
          ),
        ),
      ),
    );
  }
}

// Custom Painter for the Carrom Board
class CarromBoardPainter extends CustomPainter {
  final CarromGameState gameState;
  final Offset? dragStart;
  final Offset? dragEnd;

  CarromBoardPainter({
    required this.gameState,
    this.dragStart,
    this.dragEnd,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final boardSize = size.width.clamp(0.0, size.height);
    final scale = boardSize / 600; // Scale from server coordinates (600x600)
    
    // Draw board background
    final boardPaint = Paint()..color = Colors.brown.shade200;
    canvas.drawRect(Rect.fromLTWH(0, 0, boardSize, boardSize), boardPaint);
    
    // Draw pockets
    final pocketPaint = Paint()..color = Colors.black;
    final pockets = [
      Offset(30, 30),
      Offset(570, 30),
      Offset(30, 570),
      Offset(570, 570),
    ];
    
    for (final pocket in pockets) {
      canvas.drawCircle(
        Offset(pocket.dx * scale, pocket.dy * scale),
        25 * scale,
        pocketPaint,
      );
    }
    
    // Draw center circle
    final centerPaint = Paint()
      ..color = Colors.brown.shade400
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    canvas.drawCircle(
      Offset(boardSize / 2, boardSize / 2),
      50 * scale,
      centerPaint,
    );
    
    // Draw pieces
    gameState.pieces.forEach((id, piece) {
      if (!piece.isPocketed) {
        _drawPiece(canvas, piece, scale);
      }
    });
    
    // Draw drag line for aiming
    if (dragStart != null && dragEnd != null) {
      final aimPaint = Paint()
        ..color = Colors.white.withOpacity(0.7)
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round;
      canvas.drawLine(dragStart!, dragEnd!, aimPaint);
      
      // Draw power indicator
      final distance = (dragEnd! - dragStart!).distance;
      final power = (distance * 0.5).clamp(0.0, 35.0);
      final powerText = 'Power: ${power.toInt()}';
      
      final textPainter = TextPainter(
        text: TextSpan(
          text: powerText,
          style: TextStyle(color: Colors.white, fontSize: 14),
        ),
        textDirection: TextDirection.ltr,
      );
      textPainter.layout();
      textPainter.paint(canvas, Offset(10, 10));
    }
  }
  
  void _drawPiece(Canvas canvas, CarromPiece piece, double scale) {
    final center = Offset(piece.x * scale, piece.y * scale);
    final radius = piece.radius * scale;
    
    Paint paint;
    switch (piece.type) {
      case 'white':
        paint = Paint()..color = Colors.white;
        break;
      case 'black':
        paint = Paint()..color = Colors.black;
        break;
      case 'queen':
        paint = Paint()..color = Colors.red;
        break;
      case 'striker':
        paint = Paint()
          ..color = Colors.yellow
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3;
        break;
      default:
        paint = Paint()..color = Colors.grey;
    }
    
    canvas.drawCircle(center, radius, paint);
    
    // Draw border for pieces
    if (piece.type != 'striker') {
      final borderPaint = Paint()
        ..color = Colors.black
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1;
      canvas.drawCircle(center, radius, borderPaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

// Control Panel Widget
class CarromControlPanel extends StatelessWidget {
  final CarromGameState gameState;
  final CarromWebSocketService wsService;

  const CarromControlPanel({
    Key? key,
    required this.gameState,
    required this.wsService,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final currentPlayer = gameState.players.values
        .where((p) => p.position == gameState.currentPlayerIndex)
        .firstOrNull;
    final myPlayer = gameState.players[wsService.sessionId];
    final isMyTurn = currentPlayer?.sessionId == wsService.sessionId;

    return Container(
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        border: Border(top: BorderSide(color: Colors.grey.shade300)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Player info and scores
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: gameState.players.values.map((player) {
              final isCurrentPlayer = player.sessionId == wsService.sessionId;
              final isActivePlayer = player.isActive;
              
              return Container(
                padding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: isActivePlayer 
                      ? Colors.green.shade100 
                      : isCurrentPlayer 
                          ? Colors.blue.shade100 
                          : Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isActivePlayer 
                        ? Colors.green 
                        : isCurrentPlayer 
                            ? Colors.blue 
                            : Colors.grey,
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      player.name,
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                    ),
                    Text(
                      'Score: ${player.score}',
                      style: TextStyle(fontSize: 11),
                    ),
                    Text(
                      'W:${player.whitesPocketed} B:${player.blacksPocketed}',
                      style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
                    ),
                    if (player.hasQueen)
                      Icon(Icons.star, color: Colors.red, size: 16),
                  ],
                ),
              );
            }).toList(),
          ),
          
          SizedBox(height: 16),
          
          // Action buttons
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              if (!gameState.isGameStarted && myPlayer != null && !myPlayer.isReady)
                ElevatedButton(
                  onPressed: () => wsService.markReady(),
                  child: Text('Ready'),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                ),
              
              if (gameState.isGameStarted && isMyTurn)
                ElevatedButton(
                  onPressed: () => wsService.skipTurn(),
                  child: Text('Skip Turn'),
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
                ),
              
              ElevatedButton(
                onPressed: () => wsService.exitGame(),
                child: Text('Exit'),
                style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
              ),
            ],
          ),
          
          // Striker position slider (when it's player's turn)
          if (gameState.isGameStarted && isMyTurn) ...[
            SizedBox(height: 8),
            Text('Move Striker', style: TextStyle(fontSize: 12)),
            Slider(
              value: gameState.pieces['striker']?.x ?? 300.0,
              min: 100.0,
              max: 500.0,
              onChanged: (value) {
                wsService.moveStriker(value);
              },
            ),
          ],
        ],
      ),
    );
  }
}