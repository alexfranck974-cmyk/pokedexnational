import Toast from 'react-native-root-toast';

export function toast(message: string) {
  Toast.show(message, { duration: Toast.durations.SHORT, position: Toast.positions.BOTTOM });
}
