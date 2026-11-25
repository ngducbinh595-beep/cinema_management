import { createBrowserRouter } from "react-router-dom"
import { MainLayout } from "@/layouts/MainLayout"
import { AdminLayout } from "@/layouts/AdminLayout"

// Customer pages
import { HomePage } from "@/pages/home/HomePage"
import { MoviesPage } from "@/pages/movies/MoviesPage"
import { MovieDetailPage } from "@/pages/movies/MovieDetailPage"
import { ShowtimesPage } from "@/pages/showtimes/ShowtimesPage"
import { CinemasPage } from "@/pages/cinemas/CinemasPage"
import { AIPage } from "@/pages/ai/AIPage"
import { SeatSelectionPage } from "@/pages/booking/SeatSelectionPage"
import { CheckoutPage } from "@/pages/booking/CheckoutPage"
import { MyTicketsPage } from "@/pages/tickets/MyTicketsPage"
import { MyFavoritesPage } from "@/pages/favorites/MyFavoritesPage"
import { AccountPage } from "@/pages/account/AccountPage"
import { LoginPage } from "@/pages/auth/LoginPage"
import { RegisterPage } from "@/pages/auth/RegisterPage"
import { NotFoundPage } from "@/pages/NotFoundPage"

// Admin pages
import { AdminOverviewPage } from "@/pages/admin/AdminOverviewPage"
import { AdminMoviesPage } from "@/pages/admin/AdminMoviesPage"
import { AdminShowtimesPage } from "@/pages/admin/AdminShowtimesPage"
import { AdminRoomsPage } from "@/pages/admin/AdminRoomsPage"
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage"
import { ProtectedRoute } from "@/components/common/ProtectedRoute"

export const router = createBrowserRouter([
  // Customer facing portal
  {
    path: "/",
    element: <MainLayout />,
    children: [
      { path: "homepage", element: <HomePage /> },
      { path: "movies", element: <MoviesPage /> },
      { path: "movies/:id", element: <MovieDetailPage /> },
      { path: "showtimes", element: <ShowtimesPage /> },
      { path: "cinemas", element: <CinemasPage /> },
      { path: "ai", element: <AIPage /> },
      {
        path: "booking/seats",
        element: (
          <ProtectedRoute>
            <SeatSelectionPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "booking/checkout",
        element: (
          <ProtectedRoute>
            <CheckoutPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "favorites",
        element: (
          <ProtectedRoute>
            <MyFavoritesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "my-tickets",
        element: (
          <ProtectedRoute>
            <MyTicketsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "account",
        element: (
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        ),
      },
      { index: true, element: <HomePage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },

  // Admin & Manager portal (tài khoản role='admin' hoặc 'manager' mới vào được)
  {
    path: "/admin",
    element: (
      <ProtectedRoute allowedRoles={["admin", "manager"]}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AdminOverviewPage /> },
      { path: "movies", element: <AdminMoviesPage /> },
      { path: "showtimes", element: <AdminShowtimesPage /> },
      { path: "rooms", element: <AdminRoomsPage /> },
      {
        path: "users",
        element: (
          <ProtectedRoute requiredRole="admin" fallbackPath="/admin">
            <AdminUsersPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
])
