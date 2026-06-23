import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListCategories } from "@workspace/api-client-react";
import type { Entry, EntryInput } from "@workspace/api-client-react";
import { ShowSearchField, type SelectedShow } from "@/components/show-search-field";

const entrySchema = z.object({
  title: z.string().min(1, "Title is required"),
  mediaType: z.enum(["movie", "tv"]),
  rating: z.number().min(0).max(5),
  category: z.string().min(1, "Category is required"),
  comment: z.string().optional(),
  tmdbId: z.number().optional(),
  posterPath: z.string().nullable().optional(),
  streamingProvider: z.string().nullable().optional(),
  streamingLogo: z.string().nullable().optional(),
  network: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof entrySchema>;

interface EntryFormProps {
  initialData?: Entry;
  onSubmit: (data: EntryInput) => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export function EntryForm({ initialData, onSubmit, isLoading, submitLabel = "Save" }: EntryFormProps) {
  const { data: categories } = useListCategories();
  const isEdit = !!initialData;
  const form = useForm<FormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      title: initialData?.title || "",
      mediaType: initialData?.mediaType || "movie",
      rating: 0,
      category: initialData?.category || "",
      comment: initialData?.comment || "",
      tmdbId: initialData?.tmdbId ?? undefined,
      posterPath: initialData?.posterPath ?? null,
      streamingProvider: initialData?.streamingProvider ?? null,
      streamingLogo: initialData?.streamingLogo ?? null,
      network: initialData?.network ?? null,
    },
  });

  const selectedShow: SelectedShow | null = form.watch("title")
    ? {
        title: form.watch("title"),
        mediaType: form.watch("mediaType"),
        tmdbId: form.watch("tmdbId"),
        posterPath: form.watch("posterPath"),
        streamingProvider: form.watch("streamingProvider"),
        streamingLogo: form.watch("streamingLogo"),
        network: form.watch("network"),
      }
    : null;

  const handleShowChange = (show: SelectedShow | null) => {
    form.setValue("title", show?.title ?? "", { shouldValidate: true });
    form.setValue("mediaType", show?.mediaType ?? "movie");
    form.setValue("tmdbId", show?.tmdbId ?? undefined);
    form.setValue("posterPath", show?.posterPath ?? null);
    form.setValue("streamingProvider", show?.streamingProvider ?? null);
    form.setValue("streamingLogo", show?.streamingLogo ?? null);
    form.setValue("network", show?.network ?? null);
  };

  const handleSubmit = (values: FormValues) => {
    const { rating, ...rest } = values;
    const payload: EntryInput = { ...rest };
    // Rating is the member's optional personal rating, only sent when adding a
    // new show and they actually picked a star. Editing never touches ratings.
    if (!isEdit && typeof rating === "number" && rating >= 1) {
      payload.rating = rating;
    }
    onSubmit(payload);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="title"
          render={() => (
            <FormItem>
              <FormLabel>Show</FormLabel>
              <FormControl>
                <ShowSearchField value={selectedShow} onChange={handleShowChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {!isEdit && (
          <FormField
            control={form.control}
            name="rating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your rating (optional)</FormLabel>
                <FormControl>
                  <div className="py-2">
                    <StarRating
                      value={field.value}
                      onChange={field.onChange}
                      size="lg"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category / Genre</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="h-12" data-testid="input-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(categories ?? []).map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="comment"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Thoughts (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="What did you think about it?" 
                  className="min-h-32 resize-none text-base p-4" 
                  {...field} 
                  data-testid="input-comment" 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full h-14 text-lg font-medium rounded-xl" disabled={isLoading} data-testid="button-submit">
          {submitLabel}
        </Button>
      </form>
    </Form>
  );
}
