import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Helmet } from 'react-helmet-async';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useState } from 'react';

const registerSchema = z.object({
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters'),
  contactName: z.string().min(2, 'Contact name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions'
  }),
  acceptFee: z.boolean().refine((val) => val === true, {
    message: 'You must acknowledge the 3% platform fee'
  })
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function Register() {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      organizationName: '',
      contactName: '',
      email: '',
      phone: '',
      acceptTerms: false,
      acceptFee: false
    }
  });
  
  const onSubmit = async (data: RegisterForm) => {
    try {
      const response = await apiRequest('/api/providers/register', 'POST', {
        organizationName: data.organizationName,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone || null,
        acceptedFee: data.acceptFee,
        acceptedTerms: data.acceptTerms,
        provider_fee_pct: 3,
        ai_markup_factor: 4.0
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setIsSubmitted(true);
        toast({
          title: 'Registration Submitted!',
          description: 'We will contact you within 24-48 hours to complete your onboarding.',
        });
      } else {
        throw new Error(result.error || 'Registration failed');
      }
    } catch (error) {
      toast({
        title: 'Registration Error',
        description: 'There was an issue submitting your registration. Please try again.',
        variant: 'destructive'
      });
    }
  };
  
  if (isSubmitted) {
    return (
      <>
        <Helmet>
          <title>Registration Submitted - ScholarMatch Provider Portal</title>
        </Helmet>
        <div className="container mx-auto px-4 py-16 max-w-2xl">
          <Card>
            <CardHeader className="text-center">
              <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
              <CardTitle className="text-3xl">Registration Submitted!</CardTitle>
              <CardDescription className="text-lg mt-2">
                Thank you for registering with ScholarMatch. Our team will review your application 
                and contact you within 24-48 hours to complete your provider onboarding.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => window.location.href = '/'}>
                Return to Homepage
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }
  
  return (
    <>
      <Helmet>
        <title>Register Your Organization - ScholarMatch Provider Portal</title>
        <meta name="description" content="Register your organization to provide scholarships through ScholarMatch. Transparent 3% platform fee." />
      </Helmet>
      
      <div className="container mx-auto px-4 py-16 max-w-2xl" data-testid="page-register">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl" data-testid="heading-register">
              Provider Registration
            </CardTitle>
            <CardDescription>
              Join ScholarMatch to connect your scholarships with qualified students
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Transparent Pricing
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200" data-testid="text-fee-disclosure">
                    ScholarMatch charges a <strong>3% platform fee</strong> on scholarship awards processed through our system.
                    This fee covers platform maintenance, student support, and technology costs.
                  </p>
                </div>
              </div>
            </div>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="organizationName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Acme Foundation"
                          data-testid="input-organization-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Jane Smith"
                          data-testid="input-contact-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="email"
                          placeholder="contact@acmefoundation.org"
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="tel"
                          placeholder="+1 (555) 123-4567"
                          data-testid="input-phone"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="acceptFee"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-accept-fee"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          I acknowledge the <strong>3% platform fee</strong> on scholarship awards *
                        </FormLabel>
                        <FormDescription>
                          This fee will be automatically deducted from scholarship awards processed through ScholarMatch.
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="acceptTerms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-accept-terms"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          I accept the terms and conditions *
                        </FormLabel>
                        <FormDescription>
                          By checking this box, you agree to our provider terms of service and privacy policy.
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
                
                <Button 
                  type="submit" 
                  className="w-full"
                  data-testid="button-submit-registration"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? 'Submitting...' : 'Register Organization'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
