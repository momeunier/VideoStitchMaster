import { Switch, Route } from "wouter";
import { Home } from "./pages/Home";

function App() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route>404 Page Not Found</Route>
    </Switch>
  );
}

export default App;
