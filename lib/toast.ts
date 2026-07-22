import Toast from 'react-native-root-toast';

export function toast(message: string, long?: boolean) {
  Toast.show(message, { duration: long ? Toast.durations.LONG : Toast.durations.SHORT, position: Toast.positions.BOTTOM });
}
