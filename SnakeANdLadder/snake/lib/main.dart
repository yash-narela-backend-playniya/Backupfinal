import 'package:flutter/material.dart';
import 'dart:math';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'package:provider/provider.dart';
import 'dart:convert';

/// CONFIGURATION: Set your relay IP here!
const String relayAddress =
    'ws://192.168.1.204:5002'; 

/// MODEL

class PlayerData {
  final List<int> pawnPositions;
  final int score;
  final int movesTaken;
  final int missedMoves;
  final bool disqualified;
  final String sessionId;
  final String name;
  final String uniqueId;

  PlayerData({
    required this.pawnPositions,
    required this.score,
    required this.movesTaken,
    required this.missedMoves,
    required this.disqualified,
    required this.sessionId,
    required this.name,
    required this.uniqueId,
  });

  factory PlayerData.fromJson(Map<String, dynamic> json) {
    return PlayerData(
      pawnPositions: List<int>.from(json['pawnPositions'] ?? [0, 0, 0]),
      score: json['score'] ?? 0,
      movesTaken: json['movesTaken'] ?? 0,
      missedMoves: json['missedMoves'] ?? 0,
      disqualified: json['disqualified'] ?? false,
      sessionId: json['sessionId'] ?? '',
      name: json['name'] ?? '',
      uniqueId: json['uniqueId'] ?? '',
    );
  }
}

/// GAME STATE PROVIDER

class GameState extends ChangeNotifier {
  WebSocketChannel? _channel;
  bool isConnected = false;
  bool isInRoom = false;
  String? roomId;
  String? sessionId;

  String playerName = '';
  String uniqueId = '';
  String userId = '';
  String matchOptionId = '';
  bool useBonus = false;

  Map<String, PlayerData> players = {};
  String currentPlayerId = '';
  bool gameStarted = false;
  bool gameEnded = false;
  String gameStatus = 'waiting';
  String gameMode = '';
  bool modeSelected = false;
  int countdown = 0;
  int timer = 0;
  String winner = '';

  List<int> snakeMouths = [];
  List<int> snakeTails = [];
  List<int> ladderBottoms = [];
  List<int> ladderTops = [];

  int lastDiceValue = 1;
  bool isDiceRolling = false;
  String lastMessage = '';
  bool showModeVoting = false;

  void connectToGame() {
    try {
      print('Connecting to relay: $relayAddress');
      _channel = WebSocketChannel.connect(Uri.parse(relayAddress));

      _channel!.stream.listen(
        (message) {
          print('RESPONSE: $message'); // Print every response received
          _handleMessage(message);
        },
        onError: (error) => _handleError(error),
        onDone: () => _handleDisconnection(),
      );

      isConnected = true;
      lastMessage = '';
      notifyListeners();
    } catch (e) {
      lastMessage = 'Connection error: $e';
      isConnected = false;
      notifyListeners();
    }
  }

  void _handleMessage(dynamic message) {
    try {
      final data = json.decode(message);
      final type = data['type'];
      final payload = data['data'];

      switch (type) {
        case 'joined':
          roomId = payload['roomId'];
          sessionId = payload['sessionId'];
          isInRoom = true;
          lastMessage = 'Joined room!';
          break;
        case 'state-update':
          _updateGameState(payload);
          break;
        case 'player_ready':
          lastMessage =
              '${payload['name']} is ready (${payload['totalReady']}/${payload['totalPlayers']})';
          break;
        case 'mode_vote_start':
          showModeVoting = true;
          lastMessage = 'Vote for game mode!';
          break;
        case 'mode_vote_update':
          lastMessage = 'Votes received...';
          break;
        case 'mode_selected':
          gameMode = payload['mode'];
          modeSelected = true;
          showModeVoting = false;
          lastMessage = 'Mode selected: ${payload['mode']}';
          break;
        case 'countdown-update':
          countdown = payload['countdown'];
          break;
        case 'game_started':
          gameStarted = true;
          gameStatus = 'in-progress';
          currentPlayerId = payload['firstPlayer'];
          _updateBoard(payload['board']);
          lastMessage = 'Game started!';
          break;
        case 'dice_rolled':
          lastDiceValue = payload['value'];
          isDiceRolling = false;
          lastMessage = payload['success']
              ? 'Rolled ${payload['value']}!'
              : 'Invalid move!';
          break;
        case 'pawn_moved':
          lastMessage = 'Pawn moved to ${payload['position']}';
          break;
        case 'ladder_climbed':
          lastMessage =
              'Climbed ladder from ${payload['from']} to ${payload['to']}!';
          break;
        case 'snake_bitten':
          lastMessage =
              'Snake bite! Fell from ${payload['from']} to ${payload['to']}';
          break;
        case 'collision':
          lastMessage = 'Collision! Pawn sent back to start';
          break;
        case 'turn_changed':
          currentPlayerId = payload['playerId'];
          lastMessage = '${payload['name']}\'s turn';
          break;
        case 'player_disqualified':
          lastMessage = '${payload['name']} disqualified';
          break;
        case 'game_ended':
          gameEnded = true;
          gameStatus = 'finished';
          winner = payload['winner'] ?? '';
          if (payload['isDraw'] == true) {
            lastMessage = 'Game ended in a draw!';
          } else if (payload['noContest'] == true) {
            lastMessage = 'No contest - game refunded';
          } else {
            final winnerName = players[winner]?.name ?? 'Unknown';
            lastMessage = '$winnerName wins!';
          }
          break;
        case 'timer_tick':
          timer = payload['remainingSeconds'];
          break;
        case 'info':
          lastMessage = payload['message'];
          break;
        case 'error':
          lastMessage = 'Error: ${payload['message']}';
          break;
      }

      notifyListeners();
    } catch (e) {
      lastMessage = 'Message error: $e';
      notifyListeners();
    }
  }

  void _updateGameState(Map<String, dynamic> state) {
    players.clear();
    if (state['players'] != null) {
      final playersRaw = state['players'];
      if (playersRaw is Map) {
        playersRaw.forEach((key, value) {
          players[key] = PlayerData.fromJson(value);
        });
      } else if (playersRaw is List) {
        for (var player in playersRaw) {
          final playerData = PlayerData.fromJson(player);
          players[playerData.sessionId] = playerData;
        }
      }
    }

    currentPlayerId = state['currentPlayer'] ?? '';
    gameStarted = state['started'] ?? false;
    gameEnded = state['ended'] ?? false;
    gameStatus = state['gameStatus'] ?? 'waiting';
    gameMode = state['mode'] ?? '';
    modeSelected = state['modeSelected'] ?? false;
    timer = state['timer'] ?? 0;
    countdown = state['countdown'] ?? 0;
    winner = state['winner'] ?? '';

    if (state['snakeMouths'] != null) {
      snakeMouths = List<int>.from(state['snakeMouths']);
    }
    if (state['snakeTails'] != null) {
      snakeTails = List<int>.from(state['snakeTails']);
    }
    if (state['ladderBottoms'] != null) {
      ladderBottoms = List<int>.from(state['ladderBottoms']);
    }
    if (state['ladderTops'] != null) {
      ladderTops = List<int>.from(state['ladderTops']);
    }
  }

  void _updateBoard(Map<String, dynamic> boardData) {
    final snakes = boardData['snakes'] as List<dynamic>? ?? [];
    final ladders = boardData['ladders'] as List<dynamic>? ?? [];
    snakeMouths = [];
    snakeTails = [];
    ladderBottoms = [];
    ladderTops = [];
    for (var snake in snakes) {
      snakeMouths.add(snake['from']);
      snakeTails.add(snake['to']);
    }
    for (var ladder in ladders) {
      ladderBottoms.add(ladder['from']);
      ladderTops.add(ladder['to']);
    }
  }

  void _handleError(dynamic error) {
    lastMessage = 'Connection error: $error';
    isConnected = false;
    notifyListeners();
  }

  void _handleDisconnection() {
    isConnected = false;
    isInRoom = false;
    lastMessage = 'Disconnected from server';
    notifyListeners();
  }

  void joinRoom({
    required String name,
    required String uniqueId,
    required String userId,
    required String matchOptionId,
    bool isPrivate = false,
    List<String> allowedUserIds = const [],
    bool useBonus = false,
  }) {
    this.playerName = name;
    this.uniqueId = uniqueId;
    this.userId = userId;
    this.matchOptionId = matchOptionId;
    this.useBonus = useBonus;

    _sendMessage('join_room', {
      'name': name,
      'uniqueId': "1749703909264",
      // 'uniqueId': "1749703909450",
      'userId': userId,
      'matchOptionId': "68525b688ef9800405539081",
      'isPrivate': isPrivate,
      'allowedUserIds': allowedUserIds,
      'useBonus': useBonus,
    });
  }

  void confirmJoinGame() {
    _sendMessage('join_game', {'name': playerName, 'uniqueId': uniqueId});
  }

  void voteMode(String mode) {
    if (mode == 'turn' || mode == 'time') {
      _sendMessage('vote_mode', {'mode': mode});
    }
  }

  void rollDice({int? pawnIndex}) {
    if (currentPlayerId == sessionId &&
        !isDiceRolling &&
        gameStarted &&
        !gameEnded) {
      isDiceRolling = true;
      _sendMessage('roll_dice', {'pawnIndex': pawnIndex ?? 0});
      notifyListeners();
    }
  }

  void requestRematch() {
    _sendMessage('rematch_request', {});
  }

  void _sendMessage(String type, Map<String, dynamic> data) {
    if (_channel != null && isConnected) {
      final message = json.encode({'type': type, 'data': data});
      _channel!.sink.add(message);
    }
  }

  void disconnect() {
    _sendMessage('exit', {});
    _channel?.sink.close();
    isConnected = false;
    isInRoom = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _channel?.sink.close();
    super.dispose();
  }
}

/// MAIN

void main() {
  runApp(
    ChangeNotifierProvider(create: (context) => GameState(), child: MyApp()),
  );
}

class MyApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Snakes and Ladders',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: GameLobby(),
      debugShowCheckedModeBanner: false,
    );
  }
}

/// LOBBY

class GameLobby extends StatefulWidget {
  @override
  _GameLobbyState createState() => _GameLobbyState();
}

class _GameLobbyState extends State<GameLobby> {
  final _nameController = TextEditingController(
    text: 'Player${Random().nextInt(1000)}',
  );
  final _userIdController = TextEditingController(
    text: 'user${Random().nextInt(1000)}',
  );
  final _matchOptionController = TextEditingController(
    text: '68525b688ef9800405539081',
  );
  bool _useBonus = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Snake & Ladder Lobby'),
        backgroundColor: Colors.brown,
      ),
      body: Consumer<GameState>(
        builder: (context, gameState, child) {
          if (!gameState.isConnected) {
            return _buildConnectionScreen(gameState);
          } else if (!gameState.isInRoom) {
            return _buildJoinRoomScreen(gameState);
          } else {
            return SnakesAndLaddersGame();
          }
        },
      ),
    );
  }

  Widget _buildConnectionScreen(GameState gameState) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.gamepad, size: 80, color: Colors.brown),
          SizedBox(height: 20),
          Text(
            'Snake & Ladder Game',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 40),
          ElevatedButton(
            onPressed: gameState.connectToGame,
            child: Text('Connect to Game'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.brown,
              padding: EdgeInsets.symmetric(horizontal: 40, vertical: 15),
            ),
          ),
          if (gameState.lastMessage.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 20),
              child: Text(
                gameState.lastMessage,
                style: TextStyle(color: Colors.red),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildJoinRoomScreen(GameState gameState) {
    return Padding(
      padding: EdgeInsets.all(20),
      child: Column(
        children: [
          TextField(
            controller: _nameController,
            decoration: InputDecoration(labelText: 'Player Name'),
          ),
          TextField(
            controller: _userIdController,
            decoration: InputDecoration(labelText: 'User ID'),
          ),
          TextField(
            controller: _matchOptionController,
            decoration: InputDecoration(labelText: 'Match Option ID'),
          ),
          SwitchListTile(
            title: Text('Use Bonus'),
            value: _useBonus,
            onChanged: (value) => setState(() => _useBonus = value),
          ),
          SizedBox(height: 20),
          ElevatedButton(
            onPressed: () => _joinRoom(gameState),
            child: Text('Join Room'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.brown,
              padding: EdgeInsets.symmetric(horizontal: 40, vertical: 15),
            ),
          ),
          SizedBox(height: 20),
          if (gameState.lastMessage.isNotEmpty)
            Text(gameState.lastMessage, style: TextStyle(color: Colors.red)),
        ],
      ),
    );
  }

  void _joinRoom(GameState gameState) {
    final uniqueId = 'unique_${Random().nextInt(10000)}';

    gameState.joinRoom(
      name: _nameController.text,
      uniqueId: uniqueId,
      userId: _userIdController.text,
      matchOptionId: _matchOptionController.text,
      useBonus: _useBonus,
    );
  }
}

/// GAME SCREEN

class SnakesAndLaddersGame extends StatefulWidget {
  @override
  _SnakesAndLaddersGameState createState() => _SnakesAndLaddersGameState();
}

class _SnakesAndLaddersGameState extends State<SnakesAndLaddersGame>
    with TickerProviderStateMixin {
  late AnimationController _diceController;
  List<Color> playerColors = [
    Colors.blue,
    Colors.yellow,
    Colors.red,
    Colors.green,
  ];

  @override
  void initState() {
    super.initState();
    _diceController = AnimationController(
      duration: Duration(milliseconds: 500),
      vsync: this,
    );

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final gameState = Provider.of<GameState>(context, listen: false);
      if (!gameState.gameStarted && gameState.isInRoom) {
        gameState.confirmJoinGame();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<GameState>(
        builder: (context, gameState, child) {
          return Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFF87CEEB), Color(0xFF228B22)],
              ),
            ),
            child: SafeArea(
              child: Column(
                children: [
                  _buildStatusBar(gameState),
                  _buildTimerSection(gameState),
                  if (gameState.showModeVoting) _buildModeVoting(gameState),
                  if (gameState.countdown > 0) _buildCountdown(gameState),
                  Expanded(child: _buildBoard(gameState)),
                  _buildPlayerPiecesRow(gameState),
                  SizedBox(height: 15),
                  _buildDiceSection(gameState),
                  SizedBox(height: 15),
                  _buildPlayerScores(gameState),
                  _buildGameStatus(gameState),
                  SizedBox(height: 20),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildStatusBar(GameState gameState) {
    return Container(
      height: 30,
      color: Colors.black,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Container(
            margin: EdgeInsets.only(left: 8),
            padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: gameState.isConnected ? Colors.green : Colors.red,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              gameState.isConnected ? 'ONLINE' : 'OFFLINE',
              style: TextStyle(color: Colors.white, fontSize: 10),
            ),
          ),
          Text(
            'Room: ${gameState.roomId ?? 'None'}',
            style: TextStyle(color: Colors.white, fontSize: 12),
          ),
          Icon(Icons.settings, color: Colors.white, size: 16),
        ],
      ),
    );
  }

  Widget _buildTimerSection(GameState gameState) {
    String timerText = '';
    if (gameState.gameMode == 'time' && gameState.timer > 0) {
      int minutes = gameState.timer ~/ 60;
      int seconds = gameState.timer % 60;
      timerText = 'Time Left $minutes:${seconds.toString().padLeft(2, '0')}';
    } else {
      timerText =
          'Mode: ${gameState.gameMode.isEmpty ? 'Selecting...' : gameState.gameMode}';
    }

    return Container(
      margin: EdgeInsets.symmetric(vertical: 10),
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFFD2B48C), Color(0xFFA0522D)],
          ),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Color(0xFF8B4513), width: 2),
        ),
        child: Text(
          timerText,
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 16,
          ),
        ),
      ),
    );
  }

  Widget _buildModeVoting(GameState gameState) {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      padding: EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.9),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.brown, width: 2),
      ),
      child: Column(
        children: [
          Text(
            'Choose Game Mode:',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              ElevatedButton(
                onPressed: () => gameState.voteMode('turn'),
                child: Text('Turn Based'),
                style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
              ),
              ElevatedButton(
                onPressed: () => gameState.voteMode('time'),
                child: Text('Time Based'),
                style: ElevatedButton.styleFrom(backgroundColor: Colors.orange),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCountdown(GameState gameState) {
    return Container(
      margin: EdgeInsets.all(20),
      child: Text(
        'Game starts in ${gameState.countdown}...',
        style: TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.bold,
          color: Colors.white,
          shadows: [Shadow(blurRadius: 2, color: Colors.black)],
        ),
      ),
    );
  }

  Widget _buildBoard(GameState gameState) {
    return Container(
      margin: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFD2B48C), Color(0xFFA0522D)],
        ),
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: Color(0xFF8B4513), width: 4),
      ),
      child: Padding(
        padding: EdgeInsets.all(10),
        child: AspectRatio(
          aspectRatio: 1.0,
          child: GridView.builder(
            physics: NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 10,
              crossAxisSpacing: 1.5,
              mainAxisSpacing: 1.5,
            ),
            itemCount: 100,
            itemBuilder: (context, index) {
              int cellNumber = getCellNumber(index);
              return _buildCell(cellNumber, gameState);
            },
          ),
        ),
      ),
    );
  }

  int getCellNumber(int index) {
    int row = index ~/ 10;
    int col = index % 10;

    if (row % 2 == 0) {
      return 100 - (row * 10) - col;
    } else {
      return 100 - (row * 10) - (9 - col);
    }
  }

  Color getCellColor(int cellNumber) {
    if (cellNumber % 2 == 0) {
      return Color(0xFF256182);
    } else {
      return Colors.lightBlueAccent;
    }
  }

  Widget _buildCell(int cellNumber, GameState gameState) {
    bool hasLadder = gameState.ladderBottoms.contains(cellNumber);
    bool hasSnake = gameState.snakeMouths.contains(cellNumber);

    return Container(
      decoration: BoxDecoration(
        color: getCellColor(cellNumber),
        borderRadius: BorderRadius.circular(3),
        border: Border.all(color: Colors.white.withOpacity(0.3), width: 0.5),
      ),
      child: Stack(
        children: [
          Center(
            child: Text(
              '$cellNumber',
              style: TextStyle(
                fontSize: cellNumber >= 100
                    ? 9
                    : cellNumber >= 10
                    ? 10
                    : 11,
                fontWeight: FontWeight.bold,
                color: Colors.white,
                shadows: [
                  Shadow(
                    offset: Offset(0.5, 0.5),
                    blurRadius: 1.0,
                    color: Colors.black.withOpacity(0.5),
                  ),
                ],
              ),
            ),
          ),
          if (hasSnake) _buildSnakeElement(),
          if (hasLadder) _buildLadderElement(),
          ..._buildPlayersOnCell(cellNumber, gameState),
        ],
      ),
    );
  }

  Widget _buildSnakeElement() {
    return Positioned(
      top: 1,
      right: 1,
      child: Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(
          color: Colors.red[700],
          borderRadius: BorderRadius.circular(4),
        ),
        child: Icon(Icons.trending_down, size: 6, color: Colors.white),
      ),
    );
  }

  Widget _buildLadderElement() {
    return Positioned(
      top: 1,
      right: 1,
      child: Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(
          color: Colors.brown[800],
          borderRadius: BorderRadius.circular(4),
        ),
        child: Icon(Icons.trending_up, size: 6, color: Colors.yellow),
      ),
    );
  }

  List<Widget> _buildPlayersOnCell(int cellNumber, GameState gameState) {
    List<Widget> playersOnCell = [];
    int colorIndex = 0;

    gameState.players.forEach((sessionId, player) {
      for (
        int pawnIndex = 0;
        pawnIndex < player.pawnPositions.length;
        pawnIndex++
      ) {
        if (player.pawnPositions[pawnIndex] == cellNumber && cellNumber > 0) {
          playersOnCell.add(
            Positioned(
              bottom: 1 + (playersOnCell.length % 2) * 8.0,
              left: 1 + (playersOnCell.length ~/ 2) * 8.0,
              child: Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: playerColors[colorIndex % playerColors.length],
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 0.5),
                ),
              ),
            ),
          );
        }
      }
      colorIndex++;
    });

    return playersOnCell;
  }

  Widget _buildPlayerPiecesRow(GameState gameState) {
    List<PlayerData> playersList = gameState.players.values.toList();

    return Container(
      height: 50,
      margin: EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: List.generate(4, (index) {
          PlayerData? player = index < playersList.length
              ? playersList[index]
              : null;

          return Expanded(
            child: Container(
              margin: EdgeInsets.symmetric(horizontal: 2),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFFD2B48C), Color(0xFFA0522D)],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Color(0xFF8B4513), width: 2),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: List.generate(3, (i) {
                      return Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: player != null
                              ? playerColors[index % playerColors.length]
                              : Colors.grey,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 1),
                        ),
                      );
                    }),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildDiceSection(GameState gameState) {
    bool isMyTurn = gameState.currentPlayerId == gameState.sessionId;
    bool canRoll =
        isMyTurn &&
        gameState.gameStarted &&
        !gameState.gameEnded &&
        !gameState.isDiceRolling;

    return Container(
      height: 80,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.black, width: 2),
            ),
            child: _buildStaticDiceDots(4),
          ),
          SizedBox(width: 15),
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.black, width: 2),
            ),
            child: _buildStaticDiceDots(4),
          ),
          SizedBox(width: 15),
          GestureDetector(
            onTap: canRoll ? () => _rollDice(gameState) : null,
            child: AnimatedBuilder(
              animation: _diceController,
              builder: (context, child) {
                return Transform.rotate(
                  angle: _diceController.value * 2 * pi,
                  child: Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: canRoll ? Colors.yellow : Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.black, width: 3),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black26,
                          blurRadius: 4,
                          offset: Offset(2, 2),
                        ),
                      ],
                    ),
                    child: _buildDiceDots(gameState.lastDiceValue),
                  ),
                );
              },
            ),
          ),
          SizedBox(width: 15),
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.black, width: 2),
            ),
            child: Icon(Icons.menu, color: Colors.black),
          ),
        ],
      ),
    );
  }

  Widget _buildDiceDots(int value) {
    return Stack(children: _getDiceDotsPositions(value));
  }

  Widget _buildStaticDiceDots(int value) {
    return Stack(children: _getDiceDotsPositions(value));
  }

  List<Widget> _getDiceDotsPositions(int value) {
    List<Widget> dots = [];
    switch (value) {
      case 1:
        dots.add(_buildDot(0.5, 0.5));
        break;
      case 2:
        dots.add(_buildDot(0.25, 0.25));
        dots.add(_buildDot(0.75, 0.75));
        break;
      case 3:
        dots.add(_buildDot(0.25, 0.25));
        dots.add(_buildDot(0.5, 0.5));
        dots.add(_buildDot(0.75, 0.75));
        break;
      case 4:
        dots.add(_buildDot(0.25, 0.25));
        dots.add(_buildDot(0.75, 0.25));
        dots.add(_buildDot(0.25, 0.75));
        dots.add(_buildDot(0.75, 0.75));
        break;
      case 5:
        dots.add(_buildDot(0.25, 0.25));
        dots.add(_buildDot(0.75, 0.25));
        dots.add(_buildDot(0.5, 0.5));
        dots.add(_buildDot(0.25, 0.75));
        dots.add(_buildDot(0.75, 0.75));
        break;
      case 6:
        dots.add(_buildDot(0.25, 0.2));
        dots.add(_buildDot(0.75, 0.2));
        dots.add(_buildDot(0.25, 0.5));
        dots.add(_buildDot(0.75, 0.5));
        dots.add(_buildDot(0.25, 0.8));
        dots.add(_buildDot(0.75, 0.8));
        break;
    }
    return dots;
  }

  Widget _buildDot(double x, double y) {
    return Positioned(
      left: x * 50 - 4,
      top: y * 50 - 4,
      child: Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(color: Colors.black, shape: BoxShape.circle),
      ),
    );
  }

  Widget _buildPlayerScores(GameState gameState) {
    List<PlayerData> playersList = gameState.players.values.toList();
    return Container(
      height: 60,
      margin: EdgeInsets.symmetric(horizontal: 12),
      child: Row(
        children: List.generate(4, (index) {
          PlayerData? player = index < playersList.length
              ? playersList[index]
              : null;
          return Expanded(
            child: Container(
              margin: EdgeInsets.symmetric(horizontal: 1),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFFD2B48C), Color(0xFFA0522D)],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: gameState.currentPlayerId == (player?.sessionId ?? '')
                      ? Colors.yellow
                      : Color(0xFF8B4513),
                  width: gameState.currentPlayerId == (player?.sessionId ?? '')
                      ? 3
                      : 2,
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.person,
                    color: player != null
                        ? playerColors[index % playerColors.length]
                        : Colors.grey,
                    size: 16,
                  ),
                  Text(
                    'Score',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 8,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    player != null ? '${player.score}' : '-',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildGameStatus(GameState gameState) {
    if (gameState.lastMessage.isEmpty) return SizedBox.shrink();
    return Container(
      margin: EdgeInsets.symmetric(vertical: 8),
      child: Text(
        gameState.lastMessage,
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.bold,
          fontSize: 16,
          shadows: [Shadow(blurRadius: 2, color: Colors.black)],
        ),
      ),
    );
  }

  void _rollDice(GameState gameState) {
    _diceController.reset();
    _diceController.forward();
    gameState.rollDice(pawnIndex: 0);
  }

  @override
  void dispose() {
    _diceController.dispose();
    super.dispose();
  }
}
