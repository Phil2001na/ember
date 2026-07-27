import RecipePreviewSkeleton from "@/components/RecipePreviewSkeleton";

export default function SharedRecipeLoading() {
  return (
    <main className="page fade-in" style={{ paddingTop: 30 }}>
      <RecipePreviewSkeleton />
    </main>
  );
}
