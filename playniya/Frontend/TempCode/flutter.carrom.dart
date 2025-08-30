import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class CarromGamePage extends StatefulWidget {
  @override
  State<CarromGamePage> createState() => _CarromGamePageState();
}

class _CarromGamePageState extends State<CarromGamePage> {
  WebSocketChannel? channel;
  String connectionStatus = "disconnected";
  bool isConnected = false;
  String playerName = "";
  String? myPlayerId;

  // State from server
  Map<String, dynamic>? gameState;
  List<dynamic> players = [];
  int currentPlayerIndex = 0;
  String gamePhase = "waiting";
  List events = [];
  int gameTime = 180;
  int turnTime = 10;
  double strikerX = 300;

  // Drag state
  bool isDragging = false;
  Offset dragStart = Offset.zero;
  Offset dragEnd = Offset.zero;
  bool isMyTurn = false;

  // Constants
  static const int BOARD_SIZE = 600;
  static const int POCKET_RADIUS = 25;
  static const int PIECE_RADIUS = 12;
  static const int STRIKER_RADIUS = 15;
  static const int CANVAS_SIZE = 700;
  static const int BOARD_OFFSET = 50;

  @override
  void dispose() {
    channel?.sink.close();
    super.dispose();
  }

  void connectToServer() {
    if (playerName.trim().isEmpty) return;
    setState(() {
      connectionStatus = "connecting";
    });
    channel = WebSocketChannel.connect(Uri.parse('ws://localhost:4001')); // relay port
    channel!.sink.add(jsonEncode({
      "type": "join",
      "data": {
        "name": playerName,
        // add more fields as needed
      }
    }));
    channel!.stream.listen((message) {
      final decoded = jsonDecode(message);
      final type = decoded['type'];
      final data = decoded['data'];
      if (type == "joined") {
        setState(() {
          isConnected = true;
          connectionStatus = "connected";
          // Optionally, store sessionId
        });
      } else if (type == "state") {
        setState(() {
          gameState = data;
          currentPlayerIndex = data['currentPlayerIndex'] ?? 0;
          gamePhase = data['gamePhase'] ?? "waiting";
          gameTime = data['gameTimeRemaining'] ?? 180;
          turnTime = data['turnTimeRemaining'] ?? 10;
          players = (data['players'] as Map).values.toList();
          // strikerX: get from data['pieces'] if needed
          // isMyTurn: compare sessionId to current player
        });
      } else if (type == "error") {
        setState(() {
          connectionStatus = "error";
        });
      } else if (type == "left") {
        setState(() {
          isConnected = false;
          connectionStatus = "disconnected";
        });
      }
      // handle more events as needed (e.g., events list)
    });
  }

  void sendReady() {
    channel?.sink.add(jsonEncode({"type": "playReady"}));
  }

  void sendShoot(Map dragStart, Map dragEnd, double power) {
    channel?.sink.add(jsonEncode({
      "type": "shoot",
      "data": {
        "dragStart": dragStart,
        "dragEnd": dragEnd,
        "power": power,
      }
    }));
  }

  void sendMoveStriker(double x) {
    strikerX = x;
    channel?.sink.add(jsonEncode({
      "type": "moveStriker",
      "data": { "x": x },
    }));
    setState(() {});
  }

  void disconnect() {
    channel?.sink.add(jsonEncode({"type": "exit"}));
    channel?.sink.close();
    setState(() {
      isConnected = false;
      connectionStatus = "disconnected";
    });
  }

  // -- UI below --
  @override
  Widget build(BuildContext context) {
    // Not connected, show join form
    if (!isConnected) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text("Carrom Game", style: Theme.of(context).textTheme.headline5),
              Padding(
                padding: const EdgeInsets.all(16.0),
                child: TextField(
                  decoration: InputDecoration(labelText: "Enter your name"),
                  onChanged: (val) => playerName = val,
                ),
              ),
              ElevatedButton(
                onPressed: connectToServer,
                child: Text(connectionStatus == "connecting" ? "Connecting..." : "Join Game"),
              ),
              if (connectionStatus == "error")
                Text("Connection failed.", style: TextStyle(color: Colors.red)),
            ],
          ),
        ),
      );
    }

    // Waiting for players
    if (gamePhase == "waiting") {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text("Waiting for Players", style: Theme.of(context).textTheme.headline5),
              Text("${players.length} / 4 Players"),
              ...players.map((p) => Text(p['name'] ?? "")),
              ElevatedButton(onPressed: sendReady, child: Text("Ready to Play!")),
              ElevatedButton(onPressed: disconnect, child: Text("Leave Game")),
            ],
          ),
        ),
      );
    }

    // Main Game UI
    return Scaffold(
      appBar: AppBar(
        title: Text("Carrom Game"),
        actions: [
          TextButton(onPressed: disconnect, child: Text("Leave", style: TextStyle(color: Colors.white))),
        ],
      ),
      body: Row(
        children: [
          // Game board (canvas)
          Expanded(
            child: GestureDetector(
              onPanStart: (details) {
                // TODO: handle drag start for striker (convert to board coordinates)
              },
              onPanUpdate: (details) {
                // TODO: handle drag move
              },
              onPanEnd: (details) {
                // TODO: sendShoot when drag ends
              },
              child: CustomPaint(
                size: Size(CANVAS_SIZE.toDouble(), CANVAS_SIZE.toDouble()),
                painter: CarromBoardPainter(gameState, strikerX, isDragging, dragStart, dragEnd),
              ),
            ),
          ),
          // Players, turn, and controls
          Container(
            width: 300,
            child: Column(
              children: [
                Text("Players"),
                ...players.map((p) => ListTile(
                  title: Text(p['name'] ?? ""),
                  subtitle: Text("Score: ${p['score'] ?? 0}"),
                )),
                Text("Game Time: ${gameTime}s"),
                Text("Turn Time: ${turnTime}s"),
                // Add more controls as needed (e.g., move striker with Slider)
                Slider(
                  value: strikerX,
                  min: 100,
                  max: 500,
                  onChanged: sendMoveStriker,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// Custom Painter for the carrom board (simplified!)
class CarromBoardPainter extends CustomPainter {
  final Map? gameState;
  final double strikerX;
  final bool isDragging;
  final Offset dragStart;
  final Offset dragEnd;

  CarromBoardPainter(this.gameState, this.strikerX, this.isDragging, this.dragStart, this.dragEnd);

  @override
  void paint(Canvas canvas, Size size) {
    // Draw board background, border, pockets, pieces, drag lines, etc.
    // Use the data from gameState['pieces']
    // See your React drawBoard/drawPockets/drawPieces for logic
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}