import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppLayout } from '@/components/layout/AppLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AdminRoute, GuestOnly, ProtectedRoute } from '@/components/layout/guards';
import { FullPageSpinner } from '@/components/ui/feedback';
import { RouteError, NotFoundPage } from '@/features/misc/RouteError';

const page = (loader: () => Promise<{ default: React.ComponentType }>) => {
  const Component = lazy(loader);
  return <Component />;
};
const suspense = (node: ReactNode) => <Suspense fallback={<FullPageSpinner />}>{node}</Suspense>;

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: suspense(page(() => import('@/features/landing/LandingPage'))) },
      { path: 'privacy', element: suspense(page(() => import('@/features/legal/PrivacyPage'))) },
      { path: 'terms', element: suspense(page(() => import('@/features/legal/TermsPage'))) },
    ],
  },
  { path: '/login', errorElement: <RouteError />, element: suspense(<GuestOnly>{page(() => import('@/features/auth/LoginPage'))}</GuestOnly>) },
  {
    path: '/register',
    errorElement: <RouteError />,
    element: suspense(<GuestOnly>{page(() => import('@/features/auth/RegisterPage'))}</GuestOnly>),
  },
  {
    path: '/forgot-password',
    errorElement: <RouteError />,
    element: suspense(page(() => import('@/features/auth/ForgotPasswordPage'))),
  },
  { path: '/reset-password', errorElement: <RouteError />, element: suspense(page(() => import('@/features/auth/ResetPasswordPage'))) },
  { path: '/auth/callback', errorElement: <RouteError />, element: suspense(page(() => import('@/features/auth/AuthCallbackPage'))) },
  {
    path: '/onboarding',
    errorElement: <RouteError />,
    element: suspense(<ProtectedRoute allowNotOnboarded>{page(() => import('@/features/onboarding/OnboardingPage'))}</ProtectedRoute>),
  },
  {
    path: '/app',
    errorElement: <RouteError />,
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: page(() => import('@/features/dashboard/DashboardPage')) },
      { path: 'chat', element: page(() => import('@/features/chat/ChatPage')) },
      { path: 'chat/:conversationId', element: page(() => import('@/features/chat/ChatPage')) },
      { path: 'speaking', element: page(() => import('@/features/speaking/SpeakingPage')) },
      { path: 'roleplay', element: page(() => import('@/features/roleplay/RoleplayPage')) },
      { path: 'roleplay/:scenarioId', element: page(() => import('@/features/roleplay/RoleplayChatPage')) },
      { path: 'roleplay/:scenarioId/:conversationId', element: page(() => import('@/features/roleplay/RoleplayChatPage')) },
      { path: 'vocabulary', element: page(() => import('@/features/vocabulary/VocabularyPage')) },
      { path: 'grammar', element: page(() => import('@/features/grammar/GrammarPage')) },
      { path: 'grammar/:lessonId', element: page(() => import('@/features/grammar/GrammarLessonPage')) },
      { path: 'listening', element: page(() => import('@/features/listening/ListeningPage')) },
      { path: 'listening/:lessonId', element: page(() => import('@/features/listening/ListeningLessonPage')) },
      { path: 'reading', element: page(() => import('@/features/reading/ReadingPage')) },
      { path: 'reading/:lessonId', element: page(() => import('@/features/reading/ReadingLessonPage')) },
      { path: 'writing', element: page(() => import('@/features/writing/WritingPage')) },
      { path: 'pronunciation', element: page(() => import('@/features/pronunciation/PronunciationPage')) },
      { path: 'progress', element: page(() => import('@/features/progress/ProgressPage')) },
      { path: 'profile', element: page(() => import('@/features/profile/ProfilePage')) },
      { path: 'settings', element: page(() => import('@/features/settings/SettingsPage')) },
      { path: 'admin', element: <AdminRoute>{page(() => import('@/features/admin/AdminPage'))}</AdminRoute> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
