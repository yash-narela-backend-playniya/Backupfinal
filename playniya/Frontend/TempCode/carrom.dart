class GameState {
  final bool isGameStarted;
  final bool isGameOver;
  final int currentPlayerIndex;
  final List<Player> players;
  final List<Piece> pieces;

  GameState({
    this.isGameStarted = false,
    this.isGameOver = false,
    this.currentPlayerIndex = 0,
    this.players = const [],
    this.pieces = const [],
  });

  factory GameState.fromJson(Map<String, dynamic> json) {
    return GameState(
      isGameStarted: json['isGameStarted'] ?? false,
      isGameOver: json['isGameOver'] ?? false,
      currentPlayerIndex: json['currentPlayerIndex'] ?? 0,
      players: (json['players'] as Map<String, dynamic>? ?? {})
          .values
          .map((p) => Player.fromJson(p))
          .toList(),
      pieces: (json['pieces'] as Map<String, dynamic>? ?? {})
          .values
          .map((p) => Piece.fromJson(p))
          .toList(),
    );
  }

  Player? get currentPlayer {
    if (players.isEmpty) return null;
    return players.firstWhere(
      (p) => p.position == currentPlayerIndex,
      orElse: () => players.first,
    );
  }
}

class Player {
  final String sessionId;
  final String name;
  final int score;
  final int lives;

  Player({
    required this.sessionId,
    required this.name,
    this.score = 0,
    this.lives = 3,
  });

  factory Player.fromJson(Map<String, dynamic> json) {
    return Player(
      sessionId: json['sessionId'],
      name: json['name'],
      score: json['score'] ?? 0,
      lives: json['lives'] ?? 3,
    );
  }
}

class Piece {
  final String id;
  final String type;
  final double x;
  final double y;

  Piece({
    required this.id,
    required this.type,
    required this.x,
    required this.y,
  });

  factory Piece.fromJson(Map<String, dynamic> json) {
    return Piece(
      id: json['id'],
      type: json['type'],
      x: (json['x'] as num).toDouble(),
      y: (json['y'] as num).toDouble(),
    );
  }
}