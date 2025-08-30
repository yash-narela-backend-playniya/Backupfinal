
import 'daimport 'dart:math';

import 'package:flutter/foundation.dart';

import 'package:flutter/material.dart';

import 'package:flutter/services.dart';

import 'package:flutter_svg/flutter_svg.dart';

import 'dart:math' as math;

import 'package:path_drawing/path_drawing.dart'; 

import 'package:vibration/vibration.dart';







const double COIN_RADIUS = 0.030;

const double STRIKER_RADIUS = 0.050;



const double BOARD_BOUNDARY = 0.85;

const double STRIKER_MOVEMENT_LIMIT = 0.5;



const double POCKET_INSET = 0.78;

const double POCKET_RADIUS = 0.040;





const double FRICTION = 0.98;

const double RESTITUTION = 0.7;

const double MIN_VELOCITY = 0.001;

const double SHOT_POWER_MULTIPLIER = 0.3;





const double AIM_CANCEL_THRESHOLD = 0.05;





void main() => runApp(const MyApp());



class MyApp extends StatelessWidget {

  const MyApp({super.key});



  @override

  Widget build(BuildContext context) {

    return MaterialApp(

      debugShowCheckedModeBanner: false,

      home: const CarromGameScreen(),

    );

  }

}



enum GameState { positioning, aiming, animating }



class CarromGameScreen extends StatefulWidget {

  const CarromGameScreen({super.key});



  @override

  State<CarromGameScreen> createState() => _CarromGameScreenState();

}



class _CarromGameScreenState extends State<CarromGameScreen>

    with TickerProviderStateMixin {

  GameState gameState = GameState.positioning;

  int timeRemaining = 300;

  int playerScore = 0;

  int opponentScore = 0;

  bool isPlayerTurn = true;

  bool pocketedInTurn = false;



  Offset strikerPosition = const Offset(0, 0.62);

  Offset? dragStart;

  Offset? dragCurrent;

  double shotPower = 0;

  double shotAngle = 0;



  double controllerPosition = 0.5; // Default center position (0.0 to 1.0)



  late AnimationController _animationController;

  List<PhysicsCoin> physicsCoins = [];

  late PhysicsCoin striker;



  final List<Offset> pockets = const [

    Offset(-POCKET_INSET, -POCKET_INSET),

    Offset(POCKET_INSET, -POCKET_INSET),

    Offset(-POCKET_INSET, POCKET_INSET),

    Offset(POCKET_INSET, POCKET_INSET),

  ];



  @override

  void initState() {

    super.initState();

    _setupInitialCoins();



    _animationController = AnimationController(

      vsync: this,

      duration: const Duration(seconds: 10),

    )..addListener(_updateGamePhysics);



    _animationController.addStatusListener((status) {

      if (status == AnimationStatus.completed) _onAnimationEnd();

    });

  }



  void _onPanStart(DragStartDetails details, Size boardSize) {

    if (gameState != GameState.positioning) return;



    final touchPosition =

    _getNormalizedPosition(details.localPosition, boardSize);

    final distanceToStriker = (touchPosition - striker.position).distance;



    if (distanceToStriker < STRIKER_RADIUS * 1.5) {

      setState(() {

        gameState = GameState.aiming;

        dragStart = striker.position;

        dragCurrent = striker.position;

        controllerPosition = 0.5;

        _safeVibrate();

      });

    }

  }



  void _onPanUpdate(DragUpdateDetails details, Size boardSize) {

    if (gameState == GameState.aiming) {

      final touchPosition = _getNormalizedPosition(details.localPosition, boardSize);

      setState(() {

        dragCurrent = touchPosition;

        final dragVector = dragStart! - dragCurrent!;

        shotAngle = dragVector.direction;

        shotPower = dragVector.distance.clamp(0.0, 0.5);



      

        final double pullDirectionY = isPlayerTurn ? 1.0 : -1.0;



        final Offset currentDragVector = dragCurrent! - dragStart!;



       

        final double pullDotProduct = currentDragVector.dy * pullDirectionY;



       

        if (pullDotProduct < 0 && shotPower < AIM_CANCEL_THRESHOLD) {

          gameState = GameState.positioning;

          dragStart = null;

          dragCurrent = null;

          shotPower = 0;

        }

      

      });

    }

  }

  void _onPanEnd(DragEndDetails details) {

    if (gameState == GameState.aiming) {

     

      if (shotPower > AIM_CANCEL_THRESHOLD) {

        _shootStriker();

      } else {

     

        setState(() {

          gameState = GameState.positioning;

          dragStart = null;

          dragCurrent = null;

          shotPower = 0;

        });

      }

    }

  }



  void _onStrikerControlPan(DragUpdateDetails details) {

    if (gameState == GameState.positioning) {

      final containerWidth = 247.27;

      final newNormalizedX =

          ((details.localPosition.dx).clamp(0, containerWidth) /

              containerWidth) *

              1.0 -

              0.5;

      final newControllerPos =

          (details.localPosition.dx).clamp(0, containerWidth) / containerWidth;



      setState(() {

        striker.position = Offset(

            newNormalizedX.clamp(

                -STRIKER_MOVEMENT_LIMIT, STRIKER_MOVEMENT_LIMIT),

            striker.position.dy);

        controllerPosition = newControllerPos;

      });

    }

  }



  void _onStrikerControlTap(TapDownDetails details) {

    if (gameState == GameState.positioning) {

      final containerWidth = 247.27;

      final newNormalizedX =

          (details.localPosition.dx / containerWidth) * 1.0 - 0.5;

      final newControllerPos = details.localPosition.dx / containerWidth;



      setState(() {

        striker.position = Offset(

            newNormalizedX.clamp(

                -STRIKER_MOVEMENT_LIMIT, STRIKER_MOVEMENT_LIMIT),

            striker.position.dy);

        controllerPosition = newControllerPos;

      });

      _safeVibrate(duration: 10);

    }

  }



  double _getStrikerControlPosition() {

    return controllerPosition;

  }



  void _shootStriker() {

    _safeVibrate(duration: 50);

    setState(() {

      gameState = GameState.animating;

      final speed = shotPower * SHOT_POWER_MULTIPLIER;

      striker.velocity =

          Offset(math.cos(shotAngle) * speed, math.sin(shotAngle) * speed);

      dragStart = null;

      dragCurrent = null;



      _animationController.forward(from: 0.0);

    });

  }



  void _onAnimationEnd({bool isFoul = false}) {

    if (!pocketedInTurn || isFoul) {

      isPlayerTurn = !isPlayerTurn;

    }

    pocketedInTurn = false;

    dragStart = null;

    dragCurrent = null;

    shotPower = 0;

    final yPos = isPlayerTurn ? 0.62 : -0.62;

    striker.position = Offset(0, yPos);

    striker.velocity = Offset.zero;



    controllerPosition = 0.5;



    setState(() => gameState = GameState.positioning);

  }



  @override

  Widget build(BuildContext context) {

    return Scaffold(

      body: Stack(

        children: [

          SizedBox.expand(

              child: SvgPicture.asset('assets/Images/backgroundcarrom.svg',

                  fit: BoxFit.cover)),

          SafeArea(

            child: Column(

              children: [

                _buildTopUI(),

                Expanded(

                  child: Center(

                    child: AspectRatio(

                      aspectRatio: 1,

                      child: Container(

                          margin: const EdgeInsets.all(20),

                          child: _buildCarromBoard()),

                    ),

                  ),

                ),

                _buildStrikerSlider(),

              ],

            ),

          ),

        ],

      ),

    );

  }



  Widget _buildStrikerSlider() {



    final bool isSliderActive = gameState == GameState.positioning;



    return Padding(

      padding: const EdgeInsets.only(bottom: 100.0),

      child: GestureDetector(

        onPanUpdate: isSliderActive ? _onStrikerControlPan : null,

        onTapDown: isSliderActive ? _onStrikerControlTap : null,

        child: Container(

          width: 247.27,

          height: 24,

          decoration: ShapeDecoration(

            color: isSliderActive

                ? const Color(0x60D9D9D9)

                : const Color(0x30D9D9D9),

            shape: RoundedRectangleBorder(

              side: BorderSide(

                  width: 0.50,

                  color: isSliderActive

                      ? Colors.white

                      : Colors.white.withOpacity(0.5)),

              borderRadius: BorderRadius.circular(72.73),

            ),

          ),

          child: Stack(

            children: [

              AnimatedPositioned(

                duration: const Duration(milliseconds: 100),

                curve: Curves.linear,

                left: controllerPosition * (247.27 - 40),

                top: -9,

                child: Opacity(

                  opacity: isSliderActive ? 1.0 : 0.5,

                  child: SvgPicture.asset(

                      "assets/Images/strickercoincarrom.svg",

                      width: 40,

                      height: 40),

                ),

              ),

            ],

          ),

        ),

      ),

    );

  }



  void _setupInitialCoins() {

    striker = PhysicsCoin(

      id: -1,

      position: strikerPosition,

      type: CoinType.striker,

      radius: STRIKER_RADIUS,

    );



    List<PhysicsCoin> coins = [];

    int idCounter = 0;

    coins.add(

        PhysicsCoin(id: idCounter++, position: const Offset(0, 0), type: CoinType.red));

    double gap = 0.075;

    List<Offset> directions = [

      Offset(1, 0),

      Offset(0.5, sqrt(3) / 2),

      Offset(-0.5, sqrt(3) / 2),

      Offset(-1, 0),

      Offset(-0.5, -sqrt(3) / 2),

      Offset(0.5, -sqrt(3) / 2),

    ];

    for (int i = 0; i < 6; i++) {

      Offset pos = directions[i] * gap;

      CoinType type = (i % 2 == 0) ? CoinType.black : CoinType.white;

      coins.add(PhysicsCoin(id: idCounter++, position: pos, type: type));

    }

    for (int i = 0; i < 6; i++) {

      Offset dir1 = directions[i];

      Offset dir2 = directions[(i + 1) % 6];

      for (int j = 1; j <= 2; j++) {

        Offset pos = (dir1 * (2 - j).toDouble() + dir2 * j.toDouble()) * gap;

        CoinType type = (i + j) % 2 == 0 ? CoinType.black : CoinType.white;

        coins.add(PhysicsCoin(id: idCounter++, position: pos, type: type));

      }

    }

    physicsCoins = coins;

  }



  @override

  void dispose() {

    _animationController.dispose();

    super.dispose();

  }



  void _updateGamePhysics() {

    setState(() {

      striker.position += striker.velocity;

      striker.velocity *= FRICTION;

      if (striker.velocity.distance < MIN_VELOCITY) striker.velocity = Offset.zero;



      for (var coin in physicsCoins) {

        coin.position += coin.velocity;

        coin.velocity *= FRICTION;

        if (coin.velocity.distance < MIN_VELOCITY) coin.velocity = Offset.zero;

      }



      _handleWallCollisions();

      _handleCoinCollisions();

      _handleStrikerCoinCollisions();

      _handlePocketing();



      if (_allObjectsStopped()) {

        _animationController.stop();



        _onAnimationEnd();

      }

    });

  }



  bool _allObjectsStopped() {

    if (striker.velocity.distance > MIN_VELOCITY) return false;

    return physicsCoins.every((coin) => coin.velocity.distance < MIN_VELOCITY);

  }



  Future<void> _safeVibrate({int duration = 10}) async {

    if (kIsWeb) return;

    try {

      if (await Vibration.hasVibrator() ?? false) {

        Vibration.vibrate(duration: duration);

      }

    } catch (e) {

      print("Could not vibrate: $e");

    }

  }



  void _handleWallCollisions() {

    if (striker.position.dx.abs() > BOARD_BOUNDARY - STRIKER_RADIUS) {

      striker.velocity =

          Offset(-striker.velocity.dx * RESTITUTION, striker.velocity.dy);

      striker.position = Offset(

          (BOARD_BOUNDARY - STRIKER_RADIUS) * striker.position.dx.sign,

          striker.position.dy);

    }

    if (striker.position.dy.abs() > BOARD_BOUNDARY - STRIKER_RADIUS) {

      striker.velocity =

          Offset(striker.velocity.dx, -striker.velocity.dy * RESTITUTION);

      striker.position = Offset(striker.position.dx,

          (BOARD_BOUNDARY - STRIKER_RADIUS) * striker.position.dy.sign);

    }

    for (var coin in physicsCoins) {

      if (coin.position.dx.abs() > BOARD_BOUNDARY - COIN_RADIUS) {

        coin.velocity =

            Offset(-coin.velocity.dx * RESTITUTION, coin.velocity.dy);

        coin.position = Offset(

            (BOARD_BOUNDARY - COIN_RADIUS) * coin.position.dx.sign,

            coin.position.dy);

      }

      if (coin.position.dy.abs() > BOARD_BOUNDARY - COIN_RADIUS) {

        coin.velocity =

            Offset(coin.velocity.dx, -coin.velocity.dy * RESTITUTION);

        coin.position = Offset(coin.position.dx,

            (BOARD_BOUNDARY - COIN_RADIUS) * coin.position.dy.sign);

      }

    }

  }



  void _handleStrikerCoinCollisions() {

    for (var coin in physicsCoins) {

      final distance = (striker.position - coin.position).distance;

      if (distance < STRIKER_RADIUS + COIN_RADIUS) {

        final normal = (coin.position - striker.position).normalize();

        final relativeVelocity = striker.velocity - coin.velocity;

        final velocityAlongNormal = relativeVelocity.dot(normal);

        if (velocityAlongNormal > 0) continue;

        final impulse = -(1 + RESTITUTION) * velocityAlongNormal;

        final strikerMassRatio = 0.4;

        final coinMassRatio = 0.6;

        striker.velocity += normal * (-impulse * strikerMassRatio);

        coin.velocity += normal * (impulse * coinMassRatio);

        final overlap = (STRIKER_RADIUS + COIN_RADIUS) - distance;

        final separation = normal * (overlap / 2);

        striker.position -= separation;

        coin.position += separation;

        _safeVibrate(duration: 20);

      }

    }

  }



  void _handleCoinCollisions() {

    for (int i = 0; i < physicsCoins.length; i++) {

      for (int j = i + 1; j < physicsCoins.length; j++) {

        final coinA = physicsCoins[i];

        final coinB = physicsCoins[j];

        final distance = (coinA.position - coinB.position).distance;

        if (distance < COIN_RADIUS * 2) {

          final normal = (coinB.position - coinA.position).normalize();

          final relativeVelocity = coinA.velocity - coinB.velocity;

          final velocityAlongNormal = relativeVelocity.dot(normal);

          if (velocityAlongNormal > 0) continue;

          final impulse = -(1 + RESTITUTION) * velocityAlongNormal;

          coinA.velocity += normal * (-impulse * 0.5);

          coinB.velocity += normal * (impulse * 0.5);

          final overlap = (COIN_RADIUS * 2) - distance;

          final separation = normal * (overlap / 2);

          coinA.position -= separation;

          coinB.position += separation;

          _safeVibrate(duration: 15);

        }

      }

    }

  }



  void _handlePocketing() {

    List<PhysicsCoin> pocketedCoins = [];

    for (var coin in physicsCoins) {

      for (var pocket in pockets) {

        if ((coin.position - pocket).distance < POCKET_RADIUS * 0.7) {

          pocketedCoins.add(coin);

          break;

        }

      }

    }

    if (pocketedCoins.isNotEmpty) {

      setState(() {

        for (var pocketedCoin in pocketedCoins) {

          physicsCoins.remove(pocketedCoin);

          _updateScore(pocketedCoin);

          pocketedInTurn = true;

        }

      });

    }

    for (var pocket in pockets) {

      if ((striker.position - pocket).distance < POCKET_RADIUS * 0.8) {

        setState(() {

          if (isPlayerTurn) playerScore = (playerScore - 50).clamp(0, 999);

          striker.velocity = Offset.zero;

          _animationController.stop();

          _onAnimationEnd(isFoul: true);

        });

        break;

      }

    }

  }



  void _updateScore(PhysicsCoin coin) {

    int points = 0;

    switch (coin.type) {

      case CoinType.black:

        points = 10;

        break;

      case CoinType.white:

        points = 20;

        break;

      case CoinType.red:

        points = 50;

        break;

      default:

        points = 0;

    }

    if (isPlayerTurn)

      playerScore += points;

    else

      opponentScore += points;

  }



  Offset _getNormalizedPosition(Offset p, Size s) =>

      Offset((p.dx / s.width) * 2 - 1, (p.dy / s.height) * 2 - 1);

  Offset _getPixelPosition(Offset p, Size s) =>

      Offset((p.dx + 1) / 2 * s.width, (p.dy + 1) / 2 * s.height);



  Widget _buildTopUI() {

    return Container(

      padding: const EdgeInsets.all(16),

      child: Row(

        mainAxisAlignment: MainAxisAlignment.spaceBetween,

        children: [

          _buildPlayerInfo('You', playerScore,

              isCurrentPlayer: isPlayerTurn,

              avatarImagePath: 'assets/Images/pro2.png'),

          Column(

            children: [

              const Text('Time Remaining',

                  style: TextStyle(color: Colors.white, fontSize: 12)),

              Text(

                '${timeRemaining ~/ 60}:${(timeRemaining % 60).toString().padLeft(2, '0')}',

                style: const TextStyle(

                    color: Colors.white,

                    fontSize: 24,

                    fontWeight: FontWeight.bold),

              ),

              _buildBottomControls(),

            ],

          ),

          _buildPlayerInfo('Opponent', opponentScore,

              isCurrentPlayer: !isPlayerTurn,

              avatarImagePath: 'assets/Images/pro1.png'),

        ],

      ),

    );

  }



  Widget _buildPlayerInfo(String name, int score,

      {required bool isCurrentPlayer, required String avatarImagePath}) {

    return Column(

      children: [

        Container(

          width: 50,

          height: 50,

          padding: const EdgeInsets.all(2),

          decoration: BoxDecoration(

            borderRadius: BorderRadius.circular(8),

            border: Border.all(

                color: isCurrentPlayer ? Colors.orange : Colors.white,

                width: 3),

          ),

          child: Image.asset(avatarImagePath, fit: BoxFit.fill),

        ),

        const SizedBox(height: 4),

        Text(name, style: const TextStyle(color: Colors.white, fontSize: 12)),

        AnimatedSwitcher(

          duration: const Duration(milliseconds: 300),

          transitionBuilder: (child, animation) =>

              FadeTransition(opacity: animation, child: child),

          child: Text('Score: $score',

              key: ValueKey(score),

              style: const TextStyle(color: Colors.white, fontSize: 10)),

        ),

      ],

    );

  }



  Widget _buildCarromBoard() {

    return LayoutBuilder(

      builder: (context, constraints) {

        final boardSize = Size(constraints.maxWidth, constraints.maxHeight);

        return GestureDetector(

          onPanStart: (details) => _onPanStart(details, boardSize),

          onPanUpdate: (details) => _onPanUpdate(details, boardSize),

          onPanEnd: _onPanEnd,

          child: Stack(

            clipBehavior: Clip.none,

            children: [

              SvgPicture.asset('assets/Images/carromboard12.svg',

                  fit: BoxFit.contain),

              CustomPaint(

                painter: PocketPainter(

                  pockets: pockets,

                  boardSize: boardSize,

                  pocketRadius: POCKET_RADIUS,

                ),

                size: boardSize,

              ),

              if (gameState == GameState.aiming &&

                  dragStart != null &&

                  dragCurrent != null)

                CustomPaint(

                  painter: AimLinePainter(

                    startPoint: _getPixelPosition(dragStart!, boardSize),

                    endPoint: _getPixelPosition(dragCurrent!, boardSize),

                    power: shotPower,

                  ),

                  size: boardSize,

                ),

              ..._buildAllPieces(boardSize),

            ],

          ),

        );

      },

    );

  }



  List<Widget> _buildAllPieces(Size boardSize) {

    List<Widget> pieces = [];

    for (var coin in physicsCoins) {

      pieces.add(_buildCoin(coin, boardSize));

    }

    pieces.add(_buildStriker(boardSize));

    return pieces;

  }



  Widget _buildCoin(PhysicsCoin coin, Size boardSize) {

    String assetPath;

    switch (coin.type) {

      case CoinType.red:

        assetPath = 'assets/Images/redcoincarrom.svg';

        break;

      case CoinType.black:

        assetPath = 'assets/Images/blackcoincarrom.svg';

        break;

      case CoinType.white:

        assetPath = 'assets/Images/whitecoincarrom.svg';

        break;

      default:

        return const SizedBox.shrink();

    }

    final pixelPos = _getPixelPosition(coin.position, boardSize);

    final coinPixelRadius = COIN_RADIUS * boardSize.width;

    return Positioned(

      left: pixelPos.dx - coinPixelRadius,

      top: pixelPos.dy - coinPixelRadius,

      child: SvgPicture.asset(assetPath,

          width: coinPixelRadius * 2, height: coinPixelRadius * 2),

    );

  }



  Widget _buildStriker(Size boardSize) {

    final pixelPos = _getPixelPosition(striker.position, boardSize);

    final strikerPixelRadius = STRIKER_RADIUS * boardSize.width;

    return Positioned(

      left: pixelPos.dx - strikerPixelRadius,

      top: pixelPos.dy - strikerPixelRadius,

      child: SvgPicture.asset('assets/Images/strickercoincarrom.svg',

          width: strikerPixelRadius * 2, height: strikerPixelRadius * 2),

    );

  }



  Widget _buildBottomControls() {

    return Padding(

      padding: const EdgeInsets.all(16),

      child: Row(

        mainAxisAlignment: MainAxisAlignment.spaceEvenly,

        children: [

          _buildScoreIndicatorSvg('assets/Images/blackcarromcoin.svg', 10),

          _buildScoreIndicatorSvg('assets/Images/whitecarromcoin.svg', 20),

          _buildScoreIndicatorSvg('assets/Images/redcarromcoin.svg', 50),

        ],

      ),

    );

  }



  Widget _buildScoreIndicatorSvg(String assetPath, int score) {

    return Column(

      children: [

        SvgPicture.asset(assetPath, width: 32, height: 32),

        const SizedBox(height: 4),

        Text('$score',

            style: const TextStyle(color: Colors.white, fontSize: 14)),

      ],

    );

  }

}



class PocketPainter extends CustomPainter {

  final List<Offset> pockets;

  final Size boardSize;

  final double pocketRadius;

  PocketPainter(

      {required this.pockets,

        required this.boardSize,

        required this.pocketRadius});



  @override

  void paint(Canvas canvas, Size size) {

    final paint = Paint()

      ..color = Colors.transparent.withOpacity(0.1)

      ..style = PaintingStyle.fill;

    final pixelRadius = pocketRadius * boardSize.width;

    for (final normalizedPos in pockets) {

      final pixelPos = Offset(

        (normalizedPos.dx + 1) / 2 * boardSize.width,

        (normalizedPos.dy + 1) / 2 * boardSize.height,

      );

      canvas.drawCircle(pixelPos, pixelRadius, paint);

    }

  }



  @override

  bool shouldRepaint(covariant PocketPainter oldDelegate) => false;

}



class AimLinePainter extends CustomPainter {

  final Offset startPoint;

  final Offset endPoint;

  final double power;

  AimLinePainter(

      {required this.startPoint, required this.endPoint, required this.power});



  @override

  void paint(Canvas canvas, Size size) {



    final double dynamicRadius = 35.0 + (power * 60.0);

    final circlePaint = Paint()

      ..color = Colors.white.withOpacity(0.5)

      ..style = PaintingStyle.stroke

      ..strokeWidth = 1;

    canvas.drawCircle(startPoint, dynamicRadius, circlePaint);



    final paint = Paint()

      ..color = Colors.blue

      ..strokeWidth = 1.5

      ..strokeCap = StrokeCap.round

      ..style = PaintingStyle.stroke;



    final path = Path()..moveTo(startPoint.dx, startPoint.dy);

    final directionVector = startPoint - endPoint;

    final normalizedDirection = directionVector.normalize();



    if (normalizedDirection != Offset.zero) {

      final fixedEndPoint = startPoint + normalizedDirection * 110.0;

      path.lineTo(fixedEndPoint.dx, fixedEndPoint.dy);

    }



    final dashedPath = dashPath(path, dashArray: CircularIntervalList<double>([10, 8]));

    canvas.drawPath(dashedPath, paint);

  }



  @override

  bool shouldRepaint(covariant AimLinePainter oldDelegate) =>

      oldDelegate.startPoint != startPoint ||

          oldDelegate.endPoint != endPoint ||

          oldDelegate.power != power;

}



enum CoinType { black, white, red, striker }



class PhysicsCoin {

  int id;

  Offset position;

  Offset velocity;

  final CoinType type;

  final double radius;

  PhysicsCoin(

      {required this.id,

        required this.position,

        this.velocity = Offset.zero,

        required this.type,

        this.radius = COIN_RADIUS});

}



extension OffsetExtensions on Offset {

  Offset normalize() {

    final magnitude = distance;

    if (magnitude == 0) return Offset.zero;

    return this / magnitude;

  }



  double dot(Offset other) => dx * other.dx + dy * other.dy;

}import 'dart:math';

import 'package:flutter/foundation.dart';

import 'package:flutter/material.dart';

import 'package:flutter/services.dart';

import 'package:flutter_svg/flutter_svg.dart';

import 'dart:math' as math;

import 'package:path_drawing/path_drawing.dart'; 

import 'package:vibration/vibration.dart';







const double COIN_RADIUS = 0.030;

const double STRIKER_RADIUS = 0.050;



const double BOARD_BOUNDARY = 0.85;

const double STRIKER_MOVEMENT_LIMIT = 0.5;



const double POCKET_INSET = 0.78;

const double POCKET_RADIUS = 0.040;





const double FRICTION = 0.98;

const double RESTITUTION = 0.7;

const double MIN_VELOCITY = 0.001;

const double SHOT_POWER_MULTIPLIER = 0.3;





const double AIM_CANCEL_THRESHOLD = 0.05;





void main() => runApp(const MyApp());



class MyApp extends StatelessWidget {

  const MyApp({super.key});



  @override

  Widget build(BuildContext context) {

    return MaterialApp(

      debugShowCheckedModeBanner: false,

      home: const CarromGameScreen(),

    );

  }

}



enum GameState { positioning, aiming, animating }



class CarromGameScreen extends StatefulWidget {

  const CarromGameScreen({super.key});



  @override

  State<CarromGameScreen> createState() => _CarromGameScreenState();

}



class _CarromGameScreenState extends State<CarromGameScreen>

    with TickerProviderStateMixin {

  GameState gameState = GameState.positioning;

  int timeRemaining = 300;

  int playerScore = 0;

  int opponentScore = 0;

  bool isPlayerTurn = true;

  bool pocketedInTurn = false;



  Offset strikerPosition = const Offset(0, 0.62);

  Offset? dragStart;

  Offset? dragCurrent;

  double shotPower = 0;

  double shotAngle = 0;



  double controllerPosition = 0.5; // Default center position (0.0 to 1.0)



  late AnimationController _animationController;

  List<PhysicsCoin> physicsCoins = [];

  late PhysicsCoin striker;



  final List<Offset> pockets = const [

    Offset(-POCKET_INSET, -POCKET_INSET),

    Offset(POCKET_INSET, -POCKET_INSET),

    Offset(-POCKET_INSET, POCKET_INSET),

    Offset(POCKET_INSET, POCKET_INSET),

  ];



  @override

  void initState() {

    super.initState();

    _setupInitialCoins();



    _animationController = AnimationController(

      vsync: this,

      duration: const Duration(seconds: 10),

    )..addListener(_updateGamePhysics);



    _animationController.addStatusListener((status) {

      if (status == AnimationStatus.completed) _onAnimationEnd();

    });

  }



  void _onPanStart(DragStartDetails details, Size boardSize) {

    if (gameState != GameState.positioning) return;



    final touchPosition =

    _getNormalizedPosition(details.localPosition, boardSize);

    final distanceToStriker = (touchPosition - striker.position).distance;



    if (distanceToStriker < STRIKER_RADIUS * 1.5) {

      setState(() {

        gameState = GameState.aiming;

        dragStart = striker.position;

        dragCurrent = striker.position;

        controllerPosition = 0.5;

        _safeVibrate();

      });

    }

  }



  void _onPanUpdate(DragUpdateDetails details, Size boardSize) {

    if (gameState == GameState.aiming) {

      final touchPosition = _getNormalizedPosition(details.localPosition, boardSize);

      setState(() {

        dragCurrent = touchPosition;

        final dragVector = dragStart! - dragCurrent!;

        shotAngle = dragVector.direction;

        shotPower = dragVector.distance.clamp(0.0, 0.5);



      

        final double pullDirectionY = isPlayerTurn ? 1.0 : -1.0;



        final Offset currentDragVector = dragCurrent! - dragStart!;



       

        final double pullDotProduct = currentDragVector.dy * pullDirectionY;



       

        if (pullDotProduct < 0 && shotPower < AIM_CANCEL_THRESHOLD) {

          gameState = GameState.positioning;

          dragStart = null;

          dragCurrent = null;

          shotPower = 0;

        }

      

      });

    }

  }

  void _onPanEnd(DragEndDetails details) {

    if (gameState == GameState.aiming) {

     

      if (shotPower > AIM_CANCEL_THRESHOLD) {

        _shootStriker();

      } else {

     

        setState(() {

          gameState = GameState.positioning;

          dragStart = null;

          dragCurrent = null;

          shotPower = 0;

        });

      }

    }

  }



  void _onStrikerControlPan(DragUpdateDetails details) {

    if (gameState == GameState.positioning) {

      final containerWidth = 247.27;

      final newNormalizedX =

          ((details.localPosition.dx).clamp(0, containerWidth) /

              containerWidth) *

              1.0 -

              0.5;

      final newControllerPos =

          (details.localPosition.dx).clamp(0, containerWidth) / containerWidth;



      setState(() {

        striker.position = Offset(

            newNormalizedX.clamp(

                -STRIKER_MOVEMENT_LIMIT, STRIKER_MOVEMENT_LIMIT),

            striker.position.dy);

        controllerPosition = newControllerPos;

      });

    }

  }



  void _onStrikerControlTap(TapDownDetails details) {

    if (gameState == GameState.positioning) {

      final containerWidth = 247.27;

      final newNormalizedX =

          (details.localPosition.dx / containerWidth) * 1.0 - 0.5;

      final newControllerPos = details.localPosition.dx / containerWidth;



      setState(() {

        striker.position = Offset(

            newNormalizedX.clamp(

                -STRIKER_MOVEMENT_LIMIT, STRIKER_MOVEMENT_LIMIT),

            striker.position.dy);

        controllerPosition = newControllerPos;

      });

      _safeVibrate(duration: 10);

    }

  }



  double _getStrikerControlPosition() {

    return controllerPosition;

  }



  void _shootStriker() {

    _safeVibrate(duration: 50);

    setState(() {

      gameState = GameState.animating;

      final speed = shotPower * SHOT_POWER_MULTIPLIER;

      striker.velocity =

          Offset(math.cos(shotAngle) * speed, math.sin(shotAngle) * speed);

      dragStart = null;

      dragCurrent = null;



      _animationController.forward(from: 0.0);

    });

  }



  void _onAnimationEnd({bool isFoul = false}) {

    if (!pocketedInTurn || isFoul) {

      isPlayerTurn = !isPlayerTurn;

    }

    pocketedInTurn = false;

    dragStart = null;

    dragCurrent = null;

    shotPower = 0;

    final yPos = isPlayerTurn ? 0.62 : -0.62;

    striker.position = Offset(0, yPos);

    striker.velocity = Offset.zero;



    controllerPosition = 0.5;



    setState(() => gameState = GameState.positioning);

  }



  @override

  Widget build(BuildContext context) {

    return Scaffold(

      body: Stack(

        children: [

          SizedBox.expand(

              child: SvgPicture.asset('assets/Images/backgroundcarrom.svg',

                  fit: BoxFit.cover)),

          SafeArea(

            child: Column(

              children: [

                _buildTopUI(),

                Expanded(

                  child: Center(

                    child: AspectRatio(

                      aspectRatio: 1,

                      child: Container(

                          margin: const EdgeInsets.all(20),

                          child: _buildCarromBoard()),

                    ),

                  ),

                ),

                _buildStrikerSlider(),

              ],

            ),

          ),

        ],

      ),

    );

  }



  Widget _buildStrikerSlider() {



    final bool isSliderActive = gameState == GameState.positioning;



    return Padding(

      padding: const EdgeInsets.only(bottom: 100.0),

      child: GestureDetector(

        onPanUpdate: isSliderActive ? _onStrikerControlPan : null,

        onTapDown: isSliderActive ? _onStrikerControlTap : null,

        child: Container(

          width: 247.27,

          height: 24,

          decoration: ShapeDecoration(

            color: isSliderActive

                ? const Color(0x60D9D9D9)

                : const Color(0x30D9D9D9),

            shape: RoundedRectangleBorder(

              side: BorderSide(

                  width: 0.50,

                  color: isSliderActive

                      ? Colors.white

                      : Colors.white.withOpacity(0.5)),

              borderRadius: BorderRadius.circular(72.73),

            ),

          ),

          child: Stack(

            children: [

              AnimatedPositioned(

                duration: const Duration(milliseconds: 100),

                curve: Curves.linear,

                left: controllerPosition * (247.27 - 40),

                top: -9,

                child: Opacity(

                  opacity: isSliderActive ? 1.0 : 0.5,

                  child: SvgPicture.asset(

                      "assets/Images/strickercoincarrom.svg",

                      width: 40,

                      height: 40),

                ),

              ),

            ],

          ),

        ),

      ),

    );

  }



  void _setupInitialCoins() {

    striker = PhysicsCoin(

      id: -1,

      position: strikerPosition,

      type: CoinType.striker,

      radius: STRIKER_RADIUS,

    );



    List<PhysicsCoin> coins = [];

    int idCounter = 0;

    coins.add(

        PhysicsCoin(id: idCounter++, position: const Offset(0, 0), type: CoinType.red));

    double gap = 0.075;

    List<Offset> directions = [

      Offset(1, 0),

      Offset(0.5, sqrt(3) / 2),

      Offset(-0.5, sqrt(3) / 2),

      Offset(-1, 0),

      Offset(-0.5, -sqrt(3) / 2),

      Offset(0.5, -sqrt(3) / 2),

    ];

    for (int i = 0; i < 6; i++) {

      Offset pos = directions[i] * gap;

      CoinType type = (i % 2 == 0) ? CoinType.black : CoinType.white;

      coins.add(PhysicsCoin(id: idCounter++, position: pos, type: type));

    }

    for (int i = 0; i < 6; i++) {

      Offset dir1 = directions[i];

      Offset dir2 = directions[(i + 1) % 6];

      for (int j = 1; j <= 2; j++) {

        Offset pos = (dir1 * (2 - j).toDouble() + dir2 * j.toDouble()) * gap;

        CoinType type = (i + j) % 2 == 0 ? CoinType.black : CoinType.white;

        coins.add(PhysicsCoin(id: idCounter++, position: pos, type: type));

      }

    }

    physicsCoins = coins;

  }



  @override

  void dispose() {

    _animationController.dispose();

    super.dispose();

  }



  void _updateGamePhysics() {

    setState(() {

      striker.position += striker.velocity;

      striker.velocity *= FRICTION;

      if (striker.velocity.distance < MIN_VELOCITY) striker.velocity = Offset.zero;



      for (var coin in physicsCoins) {

        coin.position += coin.velocity;

        coin.velocity *= FRICTION;

        if (coin.velocity.distance < MIN_VELOCITY) coin.velocity = Offset.zero;

      }



      _handleWallCollisions();

      _handleCoinCollisions();

      _handleStrikerCoinCollisions();

      _handlePocketing();



      if (_allObjectsStopped()) {

        _animationController.stop();



        _onAnimationEnd();

      }

    });

  }



  bool _allObjectsStopped() {

    if (striker.velocity.distance > MIN_VELOCITY) return false;

    return physicsCoins.every((coin) => coin.velocity.distance < MIN_VELOCITY);

  }



  Future<void> _safeVibrate({int duration = 10}) async {

    if (kIsWeb) return;

    try {

      if (await Vibration.hasVibrator() ?? false) {

        Vibration.vibrate(duration: duration);

      }

    } catch (e) {

      print("Could not vibrate: $e");

    }

  }



  void _handleWallCollisions() {

    if (striker.position.dx.abs() > BOARD_BOUNDARY - STRIKER_RADIUS) {

      striker.velocity =

          Offset(-striker.velocity.dx * RESTITUTION, striker.velocity.dy);

      striker.position = Offset(

          (BOARD_BOUNDARY - STRIKER_RADIUS) * striker.position.dx.sign,

          striker.position.dy);

    }

    if (striker.position.dy.abs() > BOARD_BOUNDARY - STRIKER_RADIUS) {

      striker.velocity =

          Offset(striker.velocity.dx, -striker.velocity.dy * RESTITUTION);

      striker.position = Offset(striker.position.dx,

          (BOARD_BOUNDARY - STRIKER_RADIUS) * striker.position.dy.sign);

    }

    for (var coin in physicsCoins) {

      if (coin.position.dx.abs() > BOARD_BOUNDARY - COIN_RADIUS) {

        coin.velocity =

            Offset(-coin.velocity.dx * RESTITUTION, coin.velocity.dy);

        coin.position = Offset(

            (BOARD_BOUNDARY - COIN_RADIUS) * coin.position.dx.sign,

            coin.position.dy);

      }

      if (coin.position.dy.abs() > BOARD_BOUNDARY - COIN_RADIUS) {

        coin.velocity =

            Offset(coin.velocity.dx, -coin.velocity.dy * RESTITUTION);

        coin.position = Offset(coin.position.dx,

            (BOARD_BOUNDARY - COIN_RADIUS) * coin.position.dy.sign);

      }

    }

  }



  void _handleStrikerCoinCollisions() {

    for (var coin in physicsCoins) {

      final distance = (striker.position - coin.position).distance;

      if (distance < STRIKER_RADIUS + COIN_RADIUS) {

        final normal = (coin.position - striker.position).normalize();

        final relativeVelocity = striker.velocity - coin.velocity;

        final velocityAlongNormal = relativeVelocity.dot(normal);

        if (velocityAlongNormal > 0) continue;

        final impulse = -(1 + RESTITUTION) * velocityAlongNormal;

        final strikerMassRatio = 0.4;

        final coinMassRatio = 0.6;

        striker.velocity += normal * (-impulse * strikerMassRatio);

        coin.velocity += normal * (impulse * coinMassRatio);

        final overlap = (STRIKER_RADIUS + COIN_RADIUS) - distance;

        final separation = normal * (overlap / 2);

        striker.position -= separation;

        coin.position += separation;

        _safeVibrate(duration: 20);

      }

    }

  }



  void _handleCoinCollisions() {

    for (int i = 0; i < physicsCoins.length; i++) {

      for (int j = i + 1; j < physicsCoins.length; j++) {

        final coinA = physicsCoins[i];

        final coinB = physicsCoins[j];

        final distance = (coinA.position - coinB.position).distance;

        if (distance < COIN_RADIUS * 2) {

          final normal = (coinB.position - coinA.position).normalize();

          final relativeVelocity = coinA.velocity - coinB.velocity;

          final velocityAlongNormal = relativeVelocity.dot(normal);

          if (velocityAlongNormal > 0) continue;

          final impulse = -(1 + RESTITUTION) * velocityAlongNormal;

          coinA.velocity += normal * (-impulse * 0.5);

          coinB.velocity += normal * (impulse * 0.5);

          final overlap = (COIN_RADIUS * 2) - distance;

          final separation = normal * (overlap / 2);

          coinA.position -= separation;

          coinB.position += separation;

          _safeVibrate(duration: 15);

        }

      }

    }

  }



  void _handlePocketing() {

    List<PhysicsCoin> pocketedCoins = [];

    for (var coin in physicsCoins) {

      for (var pocket in pockets) {

        if ((coin.position - pocket).distance < POCKET_RADIUS * 0.7) {

          pocketedCoins.add(coin);

          break;

        }

      }

    }

    if (pocketedCoins.isNotEmpty) {

      setState(() {

        for (var pocketedCoin in pocketedCoins) {

          physicsCoins.remove(pocketedCoin);

          _updateScore(pocketedCoin);

          pocketedInTurn = true;

        }

      });

    }

    for (var pocket in pockets) {

      if ((striker.position - pocket).distance < POCKET_RADIUS * 0.8) {

        setState(() {

          if (isPlayerTurn) playerScore = (playerScore - 50).clamp(0, 999);

          striker.velocity = Offset.zero;

          _animationController.stop();

          _onAnimationEnd(isFoul: true);

        });

        break;

      }

    }

  }



  void _updateScore(PhysicsCoin coin) {

    int points = 0;

    switch (coin.type) {

      case CoinType.black:

        points = 10;

        break;

      case CoinType.white:

        points = 20;

        break;

      case CoinType.red:

        points = 50;

        break;

      default:

        points = 0;

    }

    if (isPlayerTurn)

      playerScore += points;

    else

      opponentScore += points;

  }



  Offset _getNormalizedPosition(Offset p, Size s) =>

      Offset((p.dx / s.width) * 2 - 1, (p.dy / s.height) * 2 - 1);

  Offset _getPixelPosition(Offset p, Size s) =>

      Offset((p.dx + 1) / 2 * s.width, (p.dy + 1) / 2 * s.height);



  Widget _buildTopUI() {

    return Container(

      padding: const EdgeInsets.all(16),

      child: Row(

        mainAxisAlignment: MainAxisAlignment.spaceBetween,

        children: [

          _buildPlayerInfo('You', playerScore,

              isCurrentPlayer: isPlayerTurn,

              avatarImagePath: 'assets/Images/pro2.png'),

          Column(

            children: [

              const Text('Time Remaining',

                  style: TextStyle(color: Colors.white, fontSize: 12)),

              Text(

                '${timeRemaining ~/ 60}:${(timeRemaining % 60).toString().padLeft(2, '0')}',

                style: const TextStyle(

                    color: Colors.white,

                    fontSize: 24,

                    fontWeight: FontWeight.bold),

              ),

              _buildBottomControls(),

            ],

          ),

          _buildPlayerInfo('Opponent', opponentScore,

              isCurrentPlayer: !isPlayerTurn,

              avatarImagePath: 'assets/Images/pro1.png'),

        ],

      ),

    );

  }



  Widget _buildPlayerInfo(String name, int score,

      {required bool isCurrentPlayer, required String avatarImagePath}) {

    return Column(

      children: [

        Container(

          width: 50,

          height: 50,

          padding: const EdgeInsets.all(2),

          decoration: BoxDecoration(

            borderRadius: BorderRadius.circular(8),

            border: Border.all(

                color: isCurrentPlayer ? Colors.orange : Colors.white,

                width: 3),

          ),

          child: Image.asset(avatarImagePath, fit: BoxFit.fill),

        ),

        const SizedBox(height: 4),

        Text(name, style: const TextStyle(color: Colors.white, fontSize: 12)),

        AnimatedSwitcher(

          duration: const Duration(milliseconds: 300),

          transitionBuilder: (child, animation) =>

              FadeTransition(opacity: animation, child: child),

          child: Text('Score: $score',

              key: ValueKey(score),

              style: const TextStyle(color: Colors.white, fontSize: 10)),

        ),

      ],

    );

  }



  Widget _buildCarromBoard() {

    return LayoutBuilder(

      builder: (context, constraints) {

        final boardSize = Size(constraints.maxWidth, constraints.maxHeight);

        return GestureDetector(

          onPanStart: (details) => _onPanStart(details, boardSize),

          onPanUpdate: (details) => _onPanUpdate(details, boardSize),

          onPanEnd: _onPanEnd,

          child: Stack(

            clipBehavior: Clip.none,

            children: [

              SvgPicture.asset('assets/Images/carromboard12.svg',

                  fit: BoxFit.contain),

              CustomPaint(

                painter: PocketPainter(

                  pockets: pockets,

                  boardSize: boardSize,

                  pocketRadius: POCKET_RADIUS,

                ),

                size: boardSize,

              ),

              if (gameState == GameState.aiming &&

                  dragStart != null &&

                  dragCurrent != null)

                CustomPaint(

                  painter: AimLinePainter(

                    startPoint: _getPixelPosition(dragStart!, boardSize),

                    endPoint: _getPixelPosition(dragCurrent!, boardSize),

                    power: shotPower,

                  ),

                  size: boardSize,

                ),

              ..._buildAllPieces(boardSize),

            ],

          ),

        );

      },

    );

  }



  List<Widget> _buildAllPieces(Size boardSize) {

    List<Widget> pieces = [];

    for (var coin in physicsCoins) {

      pieces.add(_buildCoin(coin, boardSize));

    }

    pieces.add(_buildStriker(boardSize));

    return pieces;

  }



  Widget _buildCoin(PhysicsCoin coin, Size boardSize) {

    String assetPath;

    switch (coin.type) {

      case CoinType.red:

        assetPath = 'assets/Images/redcoincarrom.svg';

        break;

      case CoinType.black:

        assetPath = 'assets/Images/blackcoincarrom.svg';

        break;

      case CoinType.white:

        assetPath = 'assets/Images/whitecoincarrom.svg';

        break;

      default:

        return const SizedBox.shrink();

    }

    final pixelPos = _getPixelPosition(coin.position, boardSize);

    final coinPixelRadius = COIN_RADIUS * boardSize.width;

    return Positioned(

      left: pixelPos.dx - coinPixelRadius,

      top: pixelPos.dy - coinPixelRadius,

      child: SvgPicture.asset(assetPath,

          width: coinPixelRadius * 2, height: coinPixelRadius * 2),

    );

  }



  Widget _buildStriker(Size boardSize) {

    final pixelPos = _getPixelPosition(striker.position, boardSize);

    final strikerPixelRadius = STRIKER_RADIUS * boardSize.width;

    return Positioned(

      left: pixelPos.dx - strikerPixelRadius,

      top: pixelPos.dy - strikerPixelRadius,

      child: SvgPicture.asset('assets/Images/strickercoincarrom.svg',

          width: strikerPixelRadius * 2, height: strikerPixelRadius * 2),

    );

  }



  Widget _buildBottomControls() {

    return Padding(

      padding: const EdgeInsets.all(16),

      child: Row(

        mainAxisAlignment: MainAxisAlignment.spaceEvenly,

        children: [

          _buildScoreIndicatorSvg('assets/Images/blackcarromcoin.svg', 10),

          _buildScoreIndicatorSvg('assets/Images/whitecarromcoin.svg', 20),

          _buildScoreIndicatorSvg('assets/Images/redcarromcoin.svg', 50),

        ],

      ),

    );

  }



  Widget _buildScoreIndicatorSvg(String assetPath, int score) {

    return Column(

      children: [

        SvgPicture.asset(assetPath, width: 32, height: 32),

        const SizedBox(height: 4),

        Text('$score',

            style: const TextStyle(color: Colors.white, fontSize: 14)),

      ],

    );

  }

}



class PocketPainter extends CustomPainter {

  final List<Offset> pockets;

  final Size boardSize;

  final double pocketRadius;

  PocketPainter(

      {required this.pockets,

        required this.boardSize,

        required this.pocketRadius});



  @override

  void paint(Canvas canvas, Size size) {

    final paint = Paint()

      ..color = Colors.transparent.withOpacity(0.1)

      ..style = PaintingStyle.fill;

    final pixelRadius = pocketRadius * boardSize.width;

    for (final normalizedPos in pockets) {

      final pixelPos = Offset(

        (normalizedPos.dx + 1) / 2 * boardSize.width,

        (normalizedPos.dy + 1) / 2 * boardSize.height,

      );

      canvas.drawCircle(pixelPos, pixelRadius, paint);

    }

  }



  @override

  bool shouldRepaint(covariant PocketPainter oldDelegate) => false;

}



class AimLinePainter extends CustomPainter {

  final Offset startPoint;

  final Offset endPoint;

  final double power;

  AimLinePainter(

      {required this.startPoint, required this.endPoint, required this.power});



  @override

  void paint(Canvas canvas, Size size) {



    final double dynamicRadius = 35.0 + (power * 60.0);

    final circlePaint = Paint()

      ..color = Colors.white.withOpacity(0.5)

      ..style = PaintingStyle.stroke

      ..strokeWidth = 1;

    canvas.drawCircle(startPoint, dynamicRadius, circlePaint);



    final paint = Paint()

      ..color = Colors.blue

      ..strokeWidth = 1.5

      ..strokeCap = StrokeCap.round

      ..style = PaintingStyle.stroke;



    final path = Path()..moveTo(startPoint.dx, startPoint.dy);

    final directionVector = startPoint - endPoint;

    final normalizedDirection = directionVector.normalize();



    if (normalizedDirection != Offset.zero) {

      final fixedEndPoint = startPoint + normalizedDirection * 110.0;

      path.lineTo(fixedEndPoint.dx, fixedEndPoint.dy);

    }



    final dashedPath = dashPath(path, dashArray: CircularIntervalList<double>([10, 8]));

    canvas.drawPath(dashedPath, paint);

  }



  @override

  bool shouldRepaint(covariant AimLinePainter oldDelegate) =>

      oldDelegate.startPoint != startPoint ||

          oldDelegate.endPoint != endPoint ||

          oldDelegate.power != power;

}



enum CoinType { black, white, red, striker }



class PhysicsCoin {

  int id;

  Offset position;

  Offset velocity;

  final CoinType type;

  final double radius;

  PhysicsCoin(

      {required this.id,

        required this.position,

        this.velocity = Offset.zero,

        required this.type,

        this.radius = COIN_RADIUS});

}



extension OffsetExtensions on Offset {

  Offset normalize() {

    final magnitude = distance;

    if (magnitude == 0) return Offset.zero;

    return this / magnitude;

  }



  double dot(Offset other) => dx * other.dx + dy * other.dy;

}rt:math';

import 'package:flutter/foundation.dart';

import 'package:flutter/material.dart';

import 'package:flutter/services.dart';

import 'package:flutter_svg/flutter_svg.dart';

import 'dart:math' as math;

import 'package:path_drawing/path_drawing.dart'; 

import 'package:vibration/vibration.dart';







const double COIN_RADIUS = 0.030;

const double STRIKER_RADIUS = 0.050;



const double BOARD_BOUNDARY = 0.85;

const double STRIKER_MOVEMENT_LIMIT = 0.5;



const double POCKET_INSET = 0.78;

const double POCKET_RADIUS = 0.040;





const double FRICTION = 0.98;

const double RESTITUTION = 0.7;

const double MIN_VELOCITY = 0.001;

const double SHOT_POWER_MULTIPLIER = 0.3;





const double AIM_CANCEL_THRESHOLD = 0.05;





void main() => runApp(const MyApp());



class MyApp extends StatelessWidget {

  const MyApp({super.key});



  @override

  Widget build(BuildContext context) {

    return MaterialApp(

      debugShowCheckedModeBanner: false,

      home: const CarromGameScreen(),

    );

  }

}



enum GameState { positioning, aiming, animating }



class CarromGameScreen extends StatefulWidget {

  const CarromGameScreen({super.key});



  @override

  State<CarromGameScreen> createState() => _CarromGameScreenState();

}



class _CarromGameScreenState extends State<CarromGameScreen>

    with TickerProviderStateMixin {

  GameState gameState = GameState.positioning;

  int timeRemaining = 300;

  int playerScore = 0;

  int opponentScore = 0;

  bool isPlayerTurn = true;

  bool pocketedInTurn = false;



  Offset strikerPosition = const Offset(0, 0.62);

  Offset? dragStart;

  Offset? dragCurrent;

  double shotPower = 0;

  double shotAngle = 0;



  double controllerPosition = 0.5; // Default center position (0.0 to 1.0)



  late AnimationController _animationController;

  List<PhysicsCoin> physicsCoins = [];

  late PhysicsCoin striker;



  final List<Offset> pockets = const [

    Offset(-POCKET_INSET, -POCKET_INSET),

    Offset(POCKET_INSET, -POCKET_INSET),

    Offset(-POCKET_INSET, POCKET_INSET),

    Offset(POCKET_INSET, POCKET_INSET),

  ];



  @override

  void initState() {

    super.initState();

    _setupInitialCoins();



    _animationController = AnimationController(

      vsync: this,

      duration: const Duration(seconds: 10),

    )..addListener(_updateGamePhysics);



    _animationController.addStatusListener((status) {

      if (status == AnimationStatus.completed) _onAnimationEnd();

    });

  }



  void _onPanStart(DragStartDetails details, Size boardSize) {

    if (gameState != GameState.positioning) return;



    final touchPosition =

    _getNormalizedPosition(details.localPosition, boardSize);

    final distanceToStriker = (touchPosition - striker.position).distance;



    if (distanceToStriker < STRIKER_RADIUS * 1.5) {

      setState(() {

        gameState = GameState.aiming;

        dragStart = striker.position;

        dragCurrent = striker.position;

        controllerPosition = 0.5;

        _safeVibrate();

      });

    }

  }



  void _onPanUpdate(DragUpdateDetails details, Size boardSize) {

    if (gameState == GameState.aiming) {

      final touchPosition = _getNormalizedPosition(details.localPosition, boardSize);

      setState(() {

        dragCurrent = touchPosition;

        final dragVector = dragStart! - dragCurrent!;

        shotAngle = dragVector.direction;

        shotPower = dragVector.distance.clamp(0.0, 0.5);



      

        final double pullDirectionY = isPlayerTurn ? 1.0 : -1.0;



        final Offset currentDragVector = dragCurrent! - dragStart!;



       

        final double pullDotProduct = currentDragVector.dy * pullDirectionY;



       

        if (pullDotProduct < 0 && shotPower < AIM_CANCEL_THRESHOLD) {

          gameState = GameState.positioning;

          dragStart = null;

          dragCurrent = null;

          shotPower = 0;

        }

      

      });

    }

  }

  void _onPanEnd(DragEndDetails details) {

    if (gameState == GameState.aiming) {

     

      if (shotPower > AIM_CANCEL_THRESHOLD) {

        _shootStriker();

      } else {

     

        setState(() {

          gameState = GameState.positioning;

          dragStart = null;

          dragCurrent = null;

          shotPower = 0;

        });

      }

    }

  }



  void _onStrikerControlPan(DragUpdateDetails details) {

    if (gameState == GameState.positioning) {

      final containerWidth = 247.27;

      final newNormalizedX =

          ((details.localPosition.dx).clamp(0, containerWidth) /

              containerWidth) *

              1.0 -

              0.5;

      final newControllerPos =

          (details.localPosition.dx).clamp(0, containerWidth) / containerWidth;



      setState(() {

        striker.position = Offset(

            newNormalizedX.clamp(

                -STRIKER_MOVEMENT_LIMIT, STRIKER_MOVEMENT_LIMIT),

            striker.position.dy);

        controllerPosition = newControllerPos;

      });

    }

  }



  void _onStrikerControlTap(TapDownDetails details) {

    if (gameState == GameState.positioning) {

      final containerWidth = 247.27;

      final newNormalizedX =

          (details.localPosition.dx / containerWidth) * 1.0 - 0.5;

      final newControllerPos = details.localPosition.dx / containerWidth;



      setState(() {

        striker.position = Offset(

            newNormalizedX.clamp(

                -STRIKER_MOVEMENT_LIMIT, STRIKER_MOVEMENT_LIMIT),

            striker.position.dy);

        controllerPosition = newControllerPos;

      });

      _safeVibrate(duration: 10);

    }

  }



  double _getStrikerControlPosition() {

    return controllerPosition;

  }



  void _shootStriker() {

    _safeVibrate(duration: 50);

    setState(() {

      gameState = GameState.animating;

      final speed = shotPower * SHOT_POWER_MULTIPLIER;

      striker.velocity =

          Offset(math.cos(shotAngle) * speed, math.sin(shotAngle) * speed);

      dragStart = null;

      dragCurrent = null;



      _animationController.forward(from: 0.0);

    });

  }



  void _onAnimationEnd({bool isFoul = false}) {

    if (!pocketedInTurn || isFoul) {

      isPlayerTurn = !isPlayerTurn;

    }

    pocketedInTurn = false;

    dragStart = null;

    dragCurrent = null;

    shotPower = 0;

    final yPos = isPlayerTurn ? 0.62 : -0.62;

    striker.position = Offset(0, yPos);

    striker.velocity = Offset.zero;



    controllerPosition = 0.5;



    setState(() => gameState = GameState.positioning);

  }



  @override

  Widget build(BuildContext context) {

    return Scaffold(

      body: Stack(

        children: [

          SizedBox.expand(

              child: SvgPicture.asset('assets/Images/backgroundcarrom.svg',

                  fit: BoxFit.cover)),

          SafeArea(

            child: Column(

              children: [

                _buildTopUI(),

                Expanded(

                  child: Center(

                    child: AspectRatio(

                      aspectRatio: 1,

                      child: Container(

                          margin: const EdgeInsets.all(20),

                          child: _buildCarromBoard()),

                    ),

                  ),

                ),

                _buildStrikerSlider(),

              ],

            ),

          ),

        ],

      ),

    );

  }



  Widget _buildStrikerSlider() {



    final bool isSliderActive = gameState == GameState.positioning;



    return Padding(

      padding: const EdgeInsets.only(bottom: 100.0),

      child: GestureDetector(

        onPanUpdate: isSliderActive ? _onStrikerControlPan : null,

        onTapDown: isSliderActive ? _onStrikerControlTap : null,

        child: Container(

          width: 247.27,

          height: 24,

          decoration: ShapeDecoration(

            color: isSliderActive

                ? const Color(0x60D9D9D9)

                : const Color(0x30D9D9D9),

            shape: RoundedRectangleBorder(

              side: BorderSide(

                  width: 0.50,

                  color: isSliderActive

                      ? Colors.white

                      : Colors.white.withOpacity(0.5)),

              borderRadius: BorderRadius.circular(72.73),

            ),

          ),

          child: Stack(

            children: [

              AnimatedPositioned(

                duration: const Duration(milliseconds: 100),

                curve: Curves.linear,

                left: controllerPosition * (247.27 - 40),

                top: -9,

                child: Opacity(

                  opacity: isSliderActive ? 1.0 : 0.5,

                  child: SvgPicture.asset(

                      "assets/Images/strickercoincarrom.svg",

                      width: 40,

                      height: 40),

                ),

              ),

            ],

          ),

        ),

      ),

    );

  }



  void _setupInitialCoins() {

    striker = PhysicsCoin(

      id: -1,

      position: strikerPosition,

      type: CoinType.striker,

      radius: STRIKER_RADIUS,

    );



    List<PhysicsCoin> coins = [];

    int idCounter = 0;

    coins.add(

        PhysicsCoin(id: idCounter++, position: const Offset(0, 0), type: CoinType.red));

    double gap = 0.075;

    List<Offset> directions = [

      Offset(1, 0),

      Offset(0.5, sqrt(3) / 2),

      Offset(-0.5, sqrt(3) / 2),

      Offset(-1, 0),

      Offset(-0.5, -sqrt(3) / 2),

      Offset(0.5, -sqrt(3) / 2),

    ];

    for (int i = 0; i < 6; i++) {

      Offset pos = directions[i] * gap;

      CoinType type = (i % 2 == 0) ? CoinType.black : CoinType.white;

      coins.add(PhysicsCoin(id: idCounter++, position: pos, type: type));

    }

    for (int i = 0; i < 6; i++) {

      Offset dir1 = directions[i];

      Offset dir2 = directions[(i + 1) % 6];

      for (int j = 1; j <= 2; j++) {

        Offset pos = (dir1 * (2 - j).toDouble() + dir2 * j.toDouble()) * gap;

        CoinType type = (i + j) % 2 == 0 ? CoinType.black : CoinType.white;

        coins.add(PhysicsCoin(id: idCounter++, position: pos, type: type));

      }

    }

    physicsCoins = coins;

  }



  @override

  void dispose() {

    _animationController.dispose();

    super.dispose();

  }



  void _updateGamePhysics() {

    setState(() {

      striker.position += striker.velocity;

      striker.velocity *= FRICTION;

      if (striker.velocity.distance < MIN_VELOCITY) striker.velocity = Offset.zero;



      for (var coin in physicsCoins) {

        coin.position += coin.velocity;

        coin.velocity *= FRICTION;

        if (coin.velocity.distance < MIN_VELOCITY) coin.velocity = Offset.zero;

      }



      _handleWallCollisions();

      _handleCoinCollisions();

      _handleStrikerCoinCollisions();

      _handlePocketing();



      if (_allObjectsStopped()) {

        _animationController.stop();



        _onAnimationEnd();

      }

    });

  }



  bool _allObjectsStopped() {

    if (striker.velocity.distance > MIN_VELOCITY) return false;

    return physicsCoins.every((coin) => coin.velocity.distance < MIN_VELOCITY);

  }



  Future<void> _safeVibrate({int duration = 10}) async {

    if (kIsWeb) return;

    try {

      if (await Vibration.hasVibrator() ?? false) {

        Vibration.vibrate(duration: duration);

      }

    } catch (e) {

      print("Could not vibrate: $e");

    }

  }



  void _handleWallCollisions() {

    if (striker.position.dx.abs() > BOARD_BOUNDARY - STRIKER_RADIUS) {

      striker.velocity =

          Offset(-striker.velocity.dx * RESTITUTION, striker.velocity.dy);

      striker.position = Offset(

          (BOARD_BOUNDARY - STRIKER_RADIUS) * striker.position.dx.sign,

          striker.position.dy);

    }

    if (striker.position.dy.abs() > BOARD_BOUNDARY - STRIKER_RADIUS) {

      striker.velocity =

          Offset(striker.velocity.dx, -striker.velocity.dy * RESTITUTION);

      striker.position = Offset(striker.position.dx,

          (BOARD_BOUNDARY - STRIKER_RADIUS) * striker.position.dy.sign);

    }

    for (var coin in physicsCoins) {

      if (coin.position.dx.abs() > BOARD_BOUNDARY - COIN_RADIUS) {

        coin.velocity =

            Offset(-coin.velocity.dx * RESTITUTION, coin.velocity.dy);

        coin.position = Offset(

            (BOARD_BOUNDARY - COIN_RADIUS) * coin.position.dx.sign,

            coin.position.dy);

      }

      if (coin.position.dy.abs() > BOARD_BOUNDARY - COIN_RADIUS) {

        coin.velocity =

            Offset(coin.velocity.dx, -coin.velocity.dy * RESTITUTION);

        coin.position = Offset(coin.position.dx,

            (BOARD_BOUNDARY - COIN_RADIUS) * coin.position.dy.sign);

      }

    }

  }



  void _handleStrikerCoinCollisions() {

    for (var coin in physicsCoins) {

      final distance = (striker.position - coin.position).distance;

      if (distance < STRIKER_RADIUS + COIN_RADIUS) {

        final normal = (coin.position - striker.position).normalize();

        final relativeVelocity = striker.velocity - coin.velocity;

        final velocityAlongNormal = relativeVelocity.dot(normal);

        if (velocityAlongNormal > 0) continue;

        final impulse = -(1 + RESTITUTION) * velocityAlongNormal;

        final strikerMassRatio = 0.4;

        final coinMassRatio = 0.6;

        striker.velocity += normal * (-impulse * strikerMassRatio);

        coin.velocity += normal * (impulse * coinMassRatio);

        final overlap = (STRIKER_RADIUS + COIN_RADIUS) - distance;

        final separation = normal * (overlap / 2);

        striker.position -= separation;

        coin.position += separation;

        _safeVibrate(duration: 20);

      }

    }

  }



  void _handleCoinCollisions() {

    for (int i = 0; i < physicsCoins.length; i++) {

      for (int j = i + 1; j < physicsCoins.length; j++) {

        final coinA = physicsCoins[i];

        final coinB = physicsCoins[j];

        final distance = (coinA.position - coinB.position).distance;

        if (distance < COIN_RADIUS * 2) {

          final normal = (coinB.position - coinA.position).normalize();

          final relativeVelocity = coinA.velocity - coinB.velocity;

          final velocityAlongNormal = relativeVelocity.dot(normal);

          if (velocityAlongNormal > 0) continue;

          final impulse = -(1 + RESTITUTION) * velocityAlongNormal;

          coinA.velocity += normal * (-impulse * 0.5);

          coinB.velocity += normal * (impulse * 0.5);

          final overlap = (COIN_RADIUS * 2) - distance;

          final separation = normal * (overlap / 2);

          coinA.position -= separation;

          coinB.position += separation;

          _safeVibrate(duration: 15);

        }

      }

    }

  }



  void _handlePocketing() {

    List<PhysicsCoin> pocketedCoins = [];

    for (var coin in physicsCoins) {

      for (var pocket in pockets) {

        if ((coin.position - pocket).distance < POCKET_RADIUS * 0.7) {

          pocketedCoins.add(coin);

          break;

        }

      }

    }

    if (pocketedCoins.isNotEmpty) {

      setState(() {

        for (var pocketedCoin in pocketedCoins) {

          physicsCoins.remove(pocketedCoin);

          _updateScore(pocketedCoin);

          pocketedInTurn = true;

        }

      });

    }

    for (var pocket in pockets) {

      if ((striker.position - pocket).distance < POCKET_RADIUS * 0.8) {

        setState(() {

          if (isPlayerTurn) playerScore = (playerScore - 50).clamp(0, 999);

          striker.velocity = Offset.zero;

          _animationController.stop();

          _onAnimationEnd(isFoul: true);

        });

        break;

      }

    }

  }



  void _updateScore(PhysicsCoin coin) {

    int points = 0;

    switch (coin.type) {

      case CoinType.black:

        points = 10;

        break;

      case CoinType.white:

        points = 20;

        break;

      case CoinType.red:

        points = 50;

        break;

      default:

        points = 0;

    }

    if (isPlayerTurn)

      playerScore += points;

    else

      opponentScore += points;

  }



  Offset _getNormalizedPosition(Offset p, Size s) =>

      Offset((p.dx / s.width) * 2 - 1, (p.dy / s.height) * 2 - 1);

  Offset _getPixelPosition(Offset p, Size s) =>

      Offset((p.dx + 1) / 2 * s.width, (p.dy + 1) / 2 * s.height);



  Widget _buildTopUI() {

    return Container(

      padding: const EdgeInsets.all(16),

      child: Row(

        mainAxisAlignment: MainAxisAlignment.spaceBetween,

        children: [

          _buildPlayerInfo('You', playerScore,

              isCurrentPlayer: isPlayerTurn,

              avatarImagePath: 'assets/Images/pro2.png'),

          Column(

            children: [

              const Text('Time Remaining',

                  style: TextStyle(color: Colors.white, fontSize: 12)),

              Text(

                '${timeRemaining ~/ 60}:${(timeRemaining % 60).toString().padLeft(2, '0')}',

                style: const TextStyle(

                    color: Colors.white,

                    fontSize: 24,

                    fontWeight: FontWeight.bold),

              ),

              _buildBottomControls(),

            ],

          ),

          _buildPlayerInfo('Opponent', opponentScore,

              isCurrentPlayer: !isPlayerTurn,

              avatarImagePath: 'assets/Images/pro1.png'),

        ],

      ),

    );

  }



  Widget _buildPlayerInfo(String name, int score,

      {required bool isCurrentPlayer, required String avatarImagePath}) {

    return Column(

      children: [

        Container(

          width: 50,

          height: 50,

          padding: const EdgeInsets.all(2),

          decoration: BoxDecoration(

            borderRadius: BorderRadius.circular(8),

            border: Border.all(

                color: isCurrentPlayer ? Colors.orange : Colors.white,

                width: 3),

          ),

          child: Image.asset(avatarImagePath, fit: BoxFit.fill),

        ),

        const SizedBox(height: 4),

        Text(name, style: const TextStyle(color: Colors.white, fontSize: 12)),

        AnimatedSwitcher(

          duration: const Duration(milliseconds: 300),

          transitionBuilder: (child, animation) =>

              FadeTransition(opacity: animation, child: child),

          child: Text('Score: $score',

              key: ValueKey(score),

              style: const TextStyle(color: Colors.white, fontSize: 10)),

        ),

      ],

    );

  }



  Widget _buildCarromBoard() {

    return LayoutBuilder(

      builder: (context, constraints) {

        final boardSize = Size(constraints.maxWidth, constraints.maxHeight);

        return GestureDetector(

          onPanStart: (details) => _onPanStart(details, boardSize),

          onPanUpdate: (details) => _onPanUpdate(details, boardSize),

          onPanEnd: _onPanEnd,

          child: Stack(

            clipBehavior: Clip.none,

            children: [

              SvgPicture.asset('assets/Images/carromboard12.svg',

                  fit: BoxFit.contain),

              CustomPaint(

                painter: PocketPainter(

                  pockets: pockets,

                  boardSize: boardSize,

                  pocketRadius: POCKET_RADIUS,

                ),

                size: boardSize,

              ),

              if (gameState == GameState.aiming &&

                  dragStart != null &&

                  dragCurrent != null)

                CustomPaint(

                  painter: AimLinePainter(

                    startPoint: _getPixelPosition(dragStart!, boardSize),

                    endPoint: _getPixelPosition(dragCurrent!, boardSize),

                    power: shotPower,

                  ),

                  size: boardSize,

                ),

              ..._buildAllPieces(boardSize),

            ],

          ),

        );

      },

    );

  }



  List<Widget> _buildAllPieces(Size boardSize) {

    List<Widget> pieces = [];

    for (var coin in physicsCoins) {

      pieces.add(_buildCoin(coin, boardSize));

    }

    pieces.add(_buildStriker(boardSize));

    return pieces;

  }



  Widget _buildCoin(PhysicsCoin coin, Size boardSize) {

    String assetPath;

    switch (coin.type) {

      case CoinType.red:

        assetPath = 'assets/Images/redcoincarrom.svg';

        break;

      case CoinType.black:

        assetPath = 'assets/Images/blackcoincarrom.svg';

        break;

      case CoinType.white:

        assetPath = 'assets/Images/whitecoincarrom.svg';

        break;

      default:

        return const SizedBox.shrink();

    }

    final pixelPos = _getPixelPosition(coin.position, boardSize);

    final coinPixelRadius = COIN_RADIUS * boardSize.width;

    return Positioned(

      left: pixelPos.dx - coinPixelRadius,

      top: pixelPos.dy - coinPixelRadius,

      child: SvgPicture.asset(assetPath,

          width: coinPixelRadius * 2, height: coinPixelRadius * 2),

    );

  }



  Widget _buildStriker(Size boardSize) {

    final pixelPos = _getPixelPosition(striker.position, boardSize);

    final strikerPixelRadius = STRIKER_RADIUS * boardSize.width;

    return Positioned(

      left: pixelPos.dx - strikerPixelRadius,

      top: pixelPos.dy - strikerPixelRadius,

      child: SvgPicture.asset('assets/Images/strickercoincarrom.svg',

          width: strikerPixelRadius * 2, height: strikerPixelRadius * 2),

    );

  }



  Widget _buildBottomControls() {

    return Padding(

      padding: const EdgeInsets.all(16),

      child: Row(

        mainAxisAlignment: MainAxisAlignment.spaceEvenly,

        children: [

          _buildScoreIndicatorSvg('assets/Images/blackcarromcoin.svg', 10),

          _buildScoreIndicatorSvg('assets/Images/whitecarromcoin.svg', 20),

          _buildScoreIndicatorSvg('assets/Images/redcarromcoin.svg', 50),

        ],

      ),

    );

  }



  Widget _buildScoreIndicatorSvg(String assetPath, int score) {

    return Column(

      children: [

        SvgPicture.asset(assetPath, width: 32, height: 32),

        const SizedBox(height: 4),

        Text('$score',

            style: const TextStyle(color: Colors.white, fontSize: 14)),

      ],

    );

  }

}



class PocketPainter extends CustomPainter {

  final List<Offset> pockets;

  final Size boardSize;

  final double pocketRadius;

  PocketPainter(

      {required this.pockets,

        required this.boardSize,

        required this.pocketRadius});



  @override

  void paint(Canvas canvas, Size size) {

    final paint = Paint()

      ..color = Colors.transparent.withOpacity(0.1)

      ..style = PaintingStyle.fill;

    final pixelRadius = pocketRadius * boardSize.width;

    for (final normalizedPos in pockets) {

      final pixelPos = Offset(

        (normalizedPos.dx + 1) / 2 * boardSize.width,

        (normalizedPos.dy + 1) / 2 * boardSize.height,

      );

      canvas.drawCircle(pixelPos, pixelRadius, paint);

    }

  }



  @override

  bool shouldRepaint(covariant PocketPainter oldDelegate) => false;

}



class AimLinePainter extends CustomPainter {

  final Offset startPoint;

  final Offset endPoint;

  final double power;

  AimLinePainter(

      {required this.startPoint, required this.endPoint, required this.power});



  @override

  void paint(Canvas canvas, Size size) {



    final double dynamicRadius = 35.0 + (power * 60.0);

    final circlePaint = Paint()

      ..color = Colors.white.withOpacity(0.5)

      ..style = PaintingStyle.stroke

      ..strokeWidth = 1;

    canvas.drawCircle(startPoint, dynamicRadius, circlePaint);



    final paint = Paint()

      ..color = Colors.blue

      ..strokeWidth = 1.5

      ..strokeCap = StrokeCap.round

      ..style = PaintingStyle.stroke;



    final path = Path()..moveTo(startPoint.dx, startPoint.dy);

    final directionVector = startPoint - endPoint;

    final normalizedDirection = directionVector.normalize();



    if (normalizedDirection != Offset.zero) {

      final fixedEndPoint = startPoint + normalizedDirection * 110.0;

      path.lineTo(fixedEndPoint.dx, fixedEndPoint.dy);

    }



    final dashedPath = dashPath(path, dashArray: CircularIntervalList<double>([10, 8]));

    canvas.drawPath(dashedPath, paint);

  }



  @override

  bool shouldRepaint(covariant AimLinePainter oldDelegate) =>

      oldDelegate.startPoint != startPoint ||

          oldDelegate.endPoint != endPoint ||

          oldDelegate.power != power;

}



enum CoinType { black, white, red, striker }



class PhysicsCoin {

  int id;

  Offset position;

  Offset velocity;

  final CoinType type;

  final double radius;

  PhysicsCoin(

      {required this.id,

        required this.position,

        this.velocity = Offset.zero,

        required this.type,

        this.radius = COIN_RADIUS});

}



extension OffsetExtensions on Offset {

  Offset normalize() {

    final magnitude = distance;

    if (magnitude == 0) return Offset.zero;

    return this / magnitude;

  }



  double dot(Offset other) => dx * other.dx + dy * other.dy;

}




