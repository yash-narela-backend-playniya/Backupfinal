import 'package:flutter/material.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

void main() => runApp(const MyApp());

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: WebSocketScreen(),
    );
  }
}

class WebSocketScreen extends StatefulWidget {
  @override
  State<WebSocketScreen> createState() => _WebSocketScreenState();
}

class _WebSocketScreenState extends State<WebSocketScreen> {
  late WebSocketChannel channel;
  final TextEditingController _controller = TextEditingController();
  String receivedMessage = "";

  @override
  void initState() {
    super.initState();

    // Connect to WebSocket
    channel = WebSocketChannel.connect(
      Uri.parse('wss://echo.websocket.events'), // <-- Public echo server
    );

    // Listen for messages from the server
    channel.stream.listen((message) {

      print(message);
      setState(() {
        receivedMessage = message;
      });
    });
  }

  void sendMessage(String text) {
    if (text.isNotEmpty) {
      channel.sink.add(text); // Send to server
      _controller.clear();
    }
  }

  @override
  void dispose() {
    channel.sink.close(); // Clean up when screen is closed
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("WebSocket Example")),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Text("Received: $receivedMessage", style: TextStyle(fontSize: 18)),
            const SizedBox(height: 20),
            TextField(
              controller: _controller,
              decoration: const InputDecoration(
                labelText: 'Enter message',
              ),
              onSubmitted: sendMessage,
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => sendMessage(_controller.text),
              child: const Text("Send"),
            ),
          ],
        ),
      ),
    );
  }
}
