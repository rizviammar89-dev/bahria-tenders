import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { roleTabs } from '@/lib/role-tabs';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  // Role is resolved before this mounts (AuthProvider gates `loading`), so the tab set is
  // correct at first mount — no remount/flash. Conditional render, not the `hidden` prop
  // (which is not respected on Android — expo/expo#41781).
  const { postJob, jobs } = roleTabs(useAuth().role);

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      {postJob && (
        <NativeTabs.Trigger name="post-job">
          <NativeTabs.Trigger.Label>Post a Job</NativeTabs.Trigger.Label>
          {/* Story 2.1: placeholder icon (reuses home.png) until a dedicated asset exists. */}
          <NativeTabs.Trigger.Icon
            src={require('@/assets/images/tabIcons/home.png')}
            renderingMode="template"
          />
        </NativeTabs.Trigger>
      )}

      {jobs && (
        <NativeTabs.Trigger name="jobs-feed">
          <NativeTabs.Trigger.Label>Jobs</NativeTabs.Trigger.Label>
          {/* Story 2.3: placeholder icon (reuses explore.png) until a dedicated asset exists. */}
          <NativeTabs.Trigger.Icon
            src={require('@/assets/images/tabIcons/explore.png')}
            renderingMode="template"
          />
        </NativeTabs.Trigger>
      )}

      {/* Push Spike: 1.1 push-gate dev tool, shown to both roles until the gate is run (then remove). */}
      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Push Spike</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
