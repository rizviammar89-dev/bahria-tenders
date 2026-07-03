import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { Brand, Colors, MontserratFont } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/lib/auth';
import { roleTabs } from '@/lib/role-tabs';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
const tabIcon =
  (name: IconName) =>
  ({ color, size }: { color: string; size: number }) => (
    <MaterialCommunityIcons name={name} size={size} color={color} />
  );

export default function AppTabs() {
  const colors = Colors[useColorScheme()];
  // Role is resolved before this mounts (AuthProvider gates `loading`), so the tab set is correct at
  // first mount. Role-specific tabs are hidden with `href: null` (kept as routes, absent from the bar).
  const { postJob, myJobs, hunt, jobs, profile } = roleTabs(useAuth().role);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.backgroundSelected,
        },
        tabBarLabelStyle: { fontFamily: MontserratFont.medium, fontSize: 11 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home-variant') }} />
      <Tabs.Screen
        name="post-job"
        options={{ title: 'Post a Job', href: postJob ? undefined : null, tabBarIcon: tabIcon('clipboard-plus-outline') }}
      />
      <Tabs.Screen
        name="my-jobs"
        options={{ title: 'My Jobs', href: myJobs ? undefined : null, tabBarIcon: tabIcon('clipboard-list-outline') }}
      />
      <Tabs.Screen
        name="hunt"
        options={{ title: 'Hunt', href: hunt ? undefined : null, tabBarIcon: tabIcon('map-search-outline') }}
      />
      <Tabs.Screen
        name="jobs-feed"
        options={{ title: 'Jobs', href: jobs ? undefined : null, tabBarIcon: tabIcon('briefcase-search-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', href: profile ? undefined : null, tabBarIcon: tabIcon('account-circle-outline') }}
      />
      {/* Dev-only push spike screen — kept as a route but removed from the tab bar. */}
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
