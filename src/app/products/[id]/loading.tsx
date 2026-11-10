import { ProductSkeleton } from "@/components/skeletons";

// Shown instantly when you click a product while its page is still being fetched.
export default function Loading() {
  return <ProductSkeleton />;
}
