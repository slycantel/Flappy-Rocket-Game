import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTailwind } from 'tailwind-rn';
import { GameEngine } from 'react-native-game-engine';

const { width, height } = Dimensions.get('window');
const ROCKET_SIZE = 40;
const PIPE_WIDTH = 60;
const PIPE_GAP = 200;
const INITIAL_ROCKET = { x: width / 4, y: height / 2, velocity: 0 };

const App = () => {
  const tailwind = useTailwind();
  const [gameState, setGameState] = useState('menu');
  const [score, setScore] = useState(0);
  const [highScores, setHighScores] = useState([]);
  const [entities, setEntities] = useState({
    rocket: { ...INITIAL_ROCKET, renderer: <Rocket /> },
    pipes: [],
  });

  // Load high scores
  useEffect(() => {
    const loadHighScores = async () => {
      try {
        const stored = await AsyncStorage.getItem('highScores');
        if (stored) setHighScores(JSON.parse(stored));
      } catch (error) {
        console.error('Error loading high scores:', error);
      }
    };
    loadHighScores();
  }, []);

  // Save high score
  const saveHighScore = async () => {
    try {
      const newScores = [...highScores, { score, date: new Date().toISOString() }]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      await AsyncStorage.setItem('highScores', JSON.stringify(newScores));
      setHighScores(newScores);
    } catch (error) {
      console.error('Error saving high score:', error);
    }
  };

  // Reset high scores
  const resetHighScores = async () => {
    try {
      await AsyncStorage.setItem('highScores', JSON.stringify([]));
      setHighScores([]);
      Alert.alert('Success', 'High scores cleared!');
    } catch (error) {
      console.error('Error resetting high scores:', error);
    }
  };

  // Game systems
  const systems = {
    moveRocket: ({ entities, touches }) => {
      const rocket = entities.rocket;
      if (touches.length > 0) {
        rocket.velocity = -10; // Flap upward
      }
      rocket.velocity += 0.5; // Gravity
      rocket.y += rocket.velocity;
      if (rocket.y < 0 || rocket.y > height - ROCKET_SIZE) {
        setGameState('gameOver');
        saveHighScore();
      }
      return entities;
    },
    spawnPipes: ({ entities, time }) => {
      if (time.current % 2000 < 50) {
        const gapY = Math.random() * (height - PIPE_GAP - 100) + 50;
        entities.pipes.push({
          x: width,
          gapY,
          passed: false,
          renderer: <Pipe />,
        });
      }
      entities.pipes = entities.pipes.map(pipe => ({
        ...pipe,
        x: pipe.x - 3,
      })).filter(pipe => pipe.x > -PIPE_WIDTH);
      return entities;
    },
    checkCollisions: ({ entities }) => {
      const rocket = entities.rocket;
      entities.pipes.forEach(pipe => {
        if (!pipe.passed && pipe.x < rocket.x) {
          setScore(score + 1);
          pipe.passed = true;
        }
        const hitTop = rocket.y < pipe.gapY && rocket.x + ROCKET_SIZE > pipe.x && rocket.x < pipe.x + PIPE_WIDTH;
        const hitBottom = rocket.y + ROCKET_SIZE > pipe.gapY + PIPE_GAP && rocket.x + ROCKET_SIZE > pipe.x && rocket.x < pipe.x + PIPE_WIDTH;
        if (hitTop || hitBottom) {
          setGameState('gameOver');
          saveHighScore();
        }
      });
      return entities;
    },
  };

  // Start game
  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setEntities({
      rocket: { ...INITIAL_ROCKET, renderer: <Rocket /> },
      pipes: [],
    });
  };

  // Render components
  const Rocket = () => {
    const style = useAnimatedStyle(() => ({
      transform: [
        { translateX: withTiming(entities.rocket.x, { duration: 50 }) },
        { translateY: withTiming(entities.rocket.y, { duration: 50 }) },
      ],
    }));
    return <Reanimated.View style={[tailwind('w-10 h-10 bg-red-500 rounded-full'), style]} />;
  };

  const Pipe = ({ x, gapY }) => {
    const topStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: withTiming(x, { duration: 50 }) }],
      height: gapY,
    }));
    const bottomStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: withTiming(x, { duration: 50 }) }],
      height: height - gapY - PIPE_GAP,
    }));
    return (
      <>
        <Reanimated.View style={[tailwind('absolute top-0 bg-green-500 w-15'), topStyle]} />
        <Reanimated.View style={[tailwind('absolute bg-green-500 w-15'), bottomStyle, { top: gapY + PIPE_GAP }]} />
      </>
    );
  };

  // Render screens
  const renderMenu = () => (
    <View style={tailwind('flex-1 justify-center items-center bg-blue-900')}>
      <Text style={tailwind('text-4xl text-white mb-8')}>Flappy Rocket</Text>
      <TouchableOpacity style={tailwind('bg-blue-500 p-4 rounded-lg mb-4')} onPress={startGame}>
        <Text style={tailwind('text-white text-lg')}>Start Game</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={tailwind('bg-gray-500 p-4 rounded-lg mb-4')}
        onPress={() => setGameState('highScores')}
      >
        <Text style={tailwind('text-white text-lg')}>High Scores</Text>
      </TouchableOpacity>
      <TouchableOpacity style={tailwind('bg-red-500 p-4 rounded-lg')} onPress={resetHighScores}>
        <Text style={tailwind('text-white text-lg')}>Reset Scores</Text>
      </TouchableOpacity>
    </View>
  );

  const renderGame = () => (
    <View style={tailwind('flex-1 bg-blue-900')}>
      <GameEngine
        style={tailwind('flex-1')}
        systems={[systems.moveRocket, systems.spawnPipes, systems.checkCollisions]}
        entities={entities}
        running={gameState === 'playing'}
      />
      <Text style={tailwind('text-white text-2xl absolute top-4 left-4')}>Score: {score}</Text>
    </View>
  );

  const renderHighScores = () => (
    <View style={tailwind('flex-1 justify-center items-center bg-blue-900')}>
      <Text style={tailwind('text-3xl text-white mb-4')}>High Scores</Text>
      {highScores.length ? (
        highScores.map((entry, index) => (
          <Text key={index} style={tailwind('text-lg text-white')}>
            {index + 1}. {entry.score} points ({entry.date})
          </Text>
        ))
      ) : (
        <Text style={tailwind('text-lg text-white')}>No high scores yet.</Text>
      )}
      <TouchableOpacity
        style={tailwind('bg-blue-500 p-4 rounded-lg mt-4')}
        onPress={() => setGameState('menu')}
      >
        <Text style={tailwind('text-white text-lg')}>Back to Menu</Text>
      </TouchableOpacity>
    </View>
  );

  const renderGameOver = () => (
    <View style={tailwind('flex-1 justify-center items-center bg-blue-900')}>
      <Text style={tailwind('text-3xl text-white mb-4')}>Game Over!</Text>
      <Text style={tailwind('text-2xl text-white mb-8')}>Score: {score}</Text>
      <TouchableOpacity style={tailwind('bg-blue-500 p-4 rounded-lg mb-4')} onPress={startGame}>
        <Text style={tailwind('text-white text-lg')}>Play Again</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={tailwind('bg-gray-500 p-4 rounded-lg')}
        onPress={() => setGameState('menu')}
      >
        <Text style={tailwind('text-white text-lg')}>Main Menu</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={tailwind('flex-1')}>
      {gameState === 'menu' && renderMenu()}
      {gameState === 'playing' && renderGame()}
      {gameState === 'highScores' && renderHighScores()}
      {gameState === 'gameOver' && renderGameOver()}
    </View>
  );
};

export default App;
