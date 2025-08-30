class CarromPlayer {
  final String name;
  final String sessionId;
  final String uniqueId;
  final int score;

  CarromPlayer({
    required this.name,
    required this.sessionId,
    required this.uniqueId,
    required this.score,
  });

  factory CarromPlayer.fromJson(Map<String, dynamic> json) {
    return CarromPlayer(
      name: json['name'] ?? '',
      sessionId: json['sessionId'] ?? '',
      uniqueId: json['uniqueId'] ?? '',
      score: json['score'] ?? 0,
    );
  }
}
