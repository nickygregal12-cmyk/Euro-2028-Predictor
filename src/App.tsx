import { ComponentsPreview } from './dev/ComponentsPreview'

function App() {
  // Lightweight path routing (no router lib yet). The dev-only design-system
  // gallery lives at /dev/components.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/dev/components')) {
    return <ComponentsPreview />
  }

  return (
    <div>
      <h1>Euro 2028 Predictor</h1>
      <p>Project scaffold — build in progress.</p>
    </div>
  )
}

export default App
