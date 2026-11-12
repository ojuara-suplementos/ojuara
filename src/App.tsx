import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import ScrollToTop from "@/components/ScrollToTop";
import { RequireAuth } from "@/components/admin/RequireAuth";
import Index from "./pages/Index.tsx";
import ProductList from "./pages/ProductList.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import Checkout from "./pages/Checkout.tsx";
import NotFound from "./pages/NotFound.tsx";
import AdminLogin from "./pages/admin/Login.tsx";
import AdminDashboard from "./pages/admin/Dashboard.tsx";
import AdminProducts from "./pages/admin/Products.tsx";
import ProductEditor from "./pages/admin/ProductEditor.tsx";
import AdminCategories from "./pages/admin/Categories.tsx";
import AdminBrands from "./pages/admin/Brands.tsx";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: () => {
      toast({
        title: "Falha ao carregar dados",
        description: "Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/produtos" element={<Layout><ProductList /></Layout>} />
              <Route path="/produto/:slug" element={<Layout><ProductDetail /></Layout>} />
              <Route path="/checkout" element={<Layout><Checkout /></Layout>} />

              {/* Admin */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<RequireAuth><AdminDashboard /></RequireAuth>} />
              <Route path="/admin/produtos" element={<RequireAuth><AdminProducts /></RequireAuth>} />
              <Route path="/admin/produtos/novo" element={<RequireAuth><ProductEditor /></RequireAuth>} />
              <Route path="/admin/produtos/:id" element={<RequireAuth><ProductEditor /></RequireAuth>} />
              <Route path="/admin/categorias" element={<RequireAuth><AdminCategories /></RequireAuth>} />
              <Route path="/admin/marcas" element={<RequireAuth><AdminBrands /></RequireAuth>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
