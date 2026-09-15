import * as Device from 'expo-device';
import { Platform } from 'react-native';

/**
 * Human-readable `device_name` for login (shown in the user's session list).
 * Contains no identifiers beyond the model name.
 */
export function getDeviceName(): string {
  const platform = Platform.OS === 'ios' ? 'iOS' : 'Android';
  const model = Device.modelName || Device.deviceName || '';
  return `Wazigo ${platform}${model ? ` · ${model}` : ''}`.slice(0, 100);
}
