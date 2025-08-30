import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import './carrom_game_state.dart';
import './carrom_game_screen.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (_) => CarromGameState(),
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Carrom Game',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.teal),
        useMaterial3: true,
      ),
      home: const CarromGameScreen(),
    );
  }
}
