import { StatusBar } from 'expo-status-bar';

import AlarmSpike from './spike/AlarmSpike';

// M0 spike root: the bespoke Android alarm hardware gate.
// The real app UI lands in M1.
export default function App() {
  return (
    <>
      <AlarmSpike />
      <StatusBar style="light" />
    </>
  );
}
