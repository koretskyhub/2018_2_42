'use strict';

import GameCore from './gamecore.js';
import Bot from './bot.js';
import Unit from './unit.js';
import TEAMS from '../conf/teams.js';
import WEAPONS from '../conf/weapons.js';
import FIELD from '../conf/field.js';

export default class OfflineGame extends GameCore {
	constructor({ scene = null } = {}) {
		super({ mode: 'offline', scene: scene });
		this.state = {
			field: [],
		};
		this.clientTurn = null;
		this.bot = null;
		this.tie = null;
	}
    
	start() {
		super.start();
	}
    
	onGameStarted() {
		//парсим команду клиента
		const uploadMap = super.parseClientTeam();

		//определяем цвет команды клиента и бота
		let enemyColor = null;
		let clientColor = uploadMap.parameter.color; 
        
		if (clientColor === TEAMS.BLUE) {
			//первым будет ходить юзер
			this.clientTurn = false;
			enemyColor = TEAMS.RED;
		} else if (clientColor === TEAMS.RED) {
			//первым будет ходить бот
			this.clientTurn = true;
			enemyColor = TEAMS.BLUE;
		} else throw 'incorrect color';

		this.bot = new Bot(this.state.field, enemyColor);

		//рандомно заполняем часть поля бота 
		uploadMap.parameter.weapons.forEach(element => {
			let u = new Unit(enemyColor);
			this.state.field.push(u);
		});

		//заполянем нейтральную территорию игрового поля
		for (let index = 0; index < FIELD.ROW*2; index++) {
			this.state.field.push(null);
		}

		//переносим полученную от клиента расстановку юнитов в стейт игры 
		uploadMap.parameter.weapons.forEach(element => {
			let u = new Unit(clientColor, element);
			this.state.field.push(u);
		});

		//вставляем флаг в рандомного юнита бота
		const botFlagPos = Math.floor(Math.random() * 12);
		this.state.field[botFlagPos].weapon = 'flag';

		this.bot.start();
        
		window.bus.publish('change-turn', this.getNextTurn());
	}

	onGameUnitMoved(movement) {
		const toCell = this.state.field[movement.to];
		const fromCell = this.state.field[movement.from];

		if (toCell === null ) {
			if (!this.moveUnit(movement.from, movement.to)){
				throw 'invalid movement';
			}
			window.bus.publish('move-unit', movement);
		} else {
			if ((toCell.weapon == WEAPONS.FLAG) && (fromCell.team !== toCell.team)) {
				const winner = (toCell.team === this.bot.botColor) ? true : false;
				window.bus.publish('finish-game', {winner: winner, from: movement.from, to: movement.to});
			} else {
				this.handleFight(movement.from, movement.to);
			}
		}
		if (!this.tie)  window.bus.publish('change-turn', this.getNextTurn());
	}

	handleFight(from, to){
		const toCell = this.state.field[to];
		const fromCell = this.state.field[from];
        
		let winner = Unit.GetWinner(fromCell, toCell);
		if (winner !== null) {
			let loser = (fromCell === winner) ? toCell : fromCell;
			let winnerIdx = this.state.field.indexOf(winner);
			let loserIdx = this.state.field.indexOf(loser);

			let winnerWeapon = winner.weapon;
			let loserWeapon = loser.weapon;

			this.state.field[from] = null;
			this.state.field[to] = winner;

			window.bus.publish('fight', {winner: {position: winnerIdx, weapon: winnerWeapon},
				loser:  {position: loserIdx, weapon: loserWeapon}});

			if (this.tie) {
				this.tie = null;
				this.bot.start();
				window.bus.publish('change-turn', this.getNextTurn());
			}
                                            
		} else {
			this.handleTie(from, to);
		}
	}

	handleTie(from, to) {
		const toCell = this.state.field[to];
		const fromCell = this.state.field[from];

		let newWeapon = WEAPONS.RandomWeapon();

		this.tie =  {
			botUnitPos: null,
			clientUnitPos: null,
			from: null,
			to: null,
		};

		this.tie.to = to;
		this.tie.from = from;

		if (fromCell.team === this.bot.botColor) {
			fromCell.weapon = newWeapon;
			this.tie.clientUnitPos = to;
			this.tie.botUnitPos = from;
		}
		else {
			toCell.weapon = newWeapon;
			this.tie.clientUnitPos = from;
			this.tie.botUnitPos = to;
		}
        
		window.bus.publish('tie', this.tie.clientUnitPos);
		this.bot.stop();
	}

	onGameRechoseWeapon(newWeapon){
		window.bus.publish('change-weapon',
			{positionId: this.tie.clientUnitPos ,weaponName: newWeapon});
		this.state.field[this.tie.clientUnitPos].weapon = newWeapon;
		this.handleFight(this.tie.from, this.tie.to);
	}

	moveUnit(fromIdx, toIdx){
		let from = this.state.field[fromIdx];
		let to = this.state.field[toIdx];

		if ((from !== null) && (to == null)) {
			this.state.field[toIdx] = from;
			this.state.field[fromIdx] = null;
			return true;
		} else return false;
	}

	getNextTurn(){
		this.clientTurn = !this.clientTurn;
		return this.clientTurn;
	}

	onGameFinished() {
		this.bot.stop();
	}

	destroy(){
		super.destroy();
		if (this.bot !== null){
			this.bot.stop();
			this.bot = null;
		} 
		this.tie = null;
		this.state = null;
	}
}
