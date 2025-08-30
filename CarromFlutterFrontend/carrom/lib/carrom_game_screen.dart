
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import './carrom_game_state.dart';

class CarromGameScreen extends StatelessWidget {
  const CarromGameScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final game = Provider.of<CarromGameState>(context);

    return Scaffold(
      appBar: AppBar(title: const Text('Carrom Game')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text('Room ID: ${game.roomId ?? "-"}'),
            Text('Current Turn: ${game.currentTurn}'),
            Text('Status: ${game.lastMessage}'),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                game.playerName = "FlutterPlayer";
                game.uniqueId = "flutter_123";
                game.connectToRelay();
                Future.delayed(const Duration(milliseconds: 500), () {
                  game.joinRoom();
                });
              },
              child: const Text("🔌 Connect & Join"),
            ),
            ElevatedButton(
              onPressed: () {
                // Example "shoot" action with valid structure
                game.shoot(
                  dragStartX: 400, dragStartY: 700,
                  dragEndX: 400, dragEndY: 600,
                  power: 50,
                );
              },
              child: const Text("🎯 Shoot"),
            ),
            ElevatedButton(
              onPressed: () {
                // Example moveStriker action
                game.moveStriker(350);
              },
              child: const Text("↔ Move Striker"),
            ),
            ElevatedButton(
              onPressed: () {
                game.requestRematch();
              },
              child: const Text("🔁 Rematch"),
            ),
            ElevatedButton(
              onPressed: () {
                game.playReady();
              },
              child: const Text("✅ Play Ready"),
            ),
          ],
        ),
      ),
    );
  }
}