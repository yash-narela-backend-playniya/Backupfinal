
const { Schema, MapSchema, type } = require('@colyseus/schema');

class Player extends Schema {
  @type('string') id;
  @type('string') playerId;
  @type('number') position;
  @type('boolean') ready;
  @type('number') score;
}

class Piece extends Schema {
  @type('string') id;
  @type('string') type; // 'coin', 'queen', 'striker'
  @type('string') color; // 'white', 'black', 'red'
  @type('number') x;
  @type('number') y;
  @type('number') angle;
  @type('boolean') active;
  @type('boolean') pocketed;
}

class CarromState extends Schema {
  @type('string') gamePhase;
  @type('string') turn;
  @type('string') winner;
  @type('boolean') canShoot;
  @type('number') shotPower;
  @type({ map: Player }) players = new MapSchema();
  @type({ map: Piece }) pieces = new MapSchema();
  @type(Piece) striker = new Piece();
  @type('object') scores = { player1: 0, player2: 0 };
  @type('object') strikerAim = { angle: 0, power: 0 };
}

module.exports = { Player, Piece, CarromState };