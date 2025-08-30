import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import RacingGame from './RacingCar'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <RacingGame/>
    </>
  )
}

export default App
