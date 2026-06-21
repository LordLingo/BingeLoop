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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/star-rating";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Film, Tv } from "lucide-react";
import { useListCategories } from "@workspace/api-client-react";
import type { Entry, EntryInput } from "@workspace/api-client-react";

const entrySchema = z.object({
  title: z.string().min(1, "Title is required"),
  mediaType: z.enum(["movie", "tv"]),
  rating: z.number().min(1).max(5),
  category: z.string().min(1, "Category is required"),
  comment: z.string().optional(),
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
  const form = useForm<FormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      title: initialData?.title || "",
      mediaType: initialData?.mediaType || "movie",
      rating: initialData?.rating || 0,
      category: initialData?.category || "",
      comment: initialData?.comment || "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="mediaType"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Type</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex gap-4"
                  data-testid="input-mediatype"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0 bg-card border border-border p-4 rounded-xl flex-1 cursor-pointer hover:border-primary/50 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                    <FormControl>
                      <RadioGroupItem value="movie" />
                    </FormControl>
                    <FormLabel className="font-normal flex items-center gap-2 cursor-pointer text-base">
                      <Film className="w-5 h-5 text-primary" />
                      Movie
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0 bg-card border border-border p-4 rounded-xl flex-1 cursor-pointer hover:border-primary/50 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
                    <FormControl>
                      <RadioGroupItem value="tv" />
                    </FormControl>
                    <FormLabel className="font-normal flex items-center gap-2 cursor-pointer text-base">
                      <Tv className="w-5 h-5 text-primary" />
                      TV Show
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Inception" {...field} data-testid="input-title" className="h-12 text-lg" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rating"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Rating</FormLabel>
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
