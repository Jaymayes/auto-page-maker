import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useState } from 'react';

interface Package {
  name: string;
  credits: number;
  price: number;
  features: string[];
  cta: string;
  popular: boolean;
}

const packages: Package[] = [
  {
    name: 'Basic',
    credits: 10,
    price: 40,
    features: [
      'Essay brainstorming assistance',
      'Grammar and style suggestions',
      'Application checklist generation',
      'Basic scholarship matching'
    ],
    cta: 'Get Started',
    popular: false
  },
  {
    name: 'Standard',
    credits: 50,
    price: 200,
    features: [
      'Everything in Basic',
      'Advanced essay feedback',
      'Unlimited scholarship searches',
      'Application deadline reminders',
      'Priority support'
    ],
    cta: 'Most Popular',
    popular: true
  },
  {
    name: 'Premium',
    credits: 200,
    price: 800,
    features: [
      'Everything in Standard',
      'Personalized application strategy',
      'Interview preparation guidance',
      'Scholarship portfolio optimization',
      'Dedicated success advisor'
    ],
    cta: 'Go Premium',
    popular: false
  }
];

export default function Pricing() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleCheckout = async (pkg: Package) => {
    setIsLoading(pkg.name);
    
    try {
      const response = await apiRequest('/api/checkout/create-session', 'POST', {
        packageName: pkg.name,
        credits: pkg.credits,
        priceInCents: pkg.price * 100
      });
      
      const data = await response.json() as { url?: string; error?: string };
      
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error === 'STRIPE_NOT_CONFIGURED') {
        toast({
          title: 'Coming Soon',
          description: 'Payment processing will be available shortly. Please check back soon!',
          variant: 'default'
        });
      } else {
        throw new Error(data.error || 'Checkout failed');
      }
    } catch (error) {
      toast({
        title: 'Checkout Unavailable',
        description: 'Payment processing is being set up. Please try again later.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <>
      <Helmet>
        <title>Pricing - ScholarMatch AI Credits</title>
        <meta name="description" content="Purchase AI credits for personalized scholarship matching and application assistance. Plans start at $40 for 10 credits." />
      </Helmet>
      
      <div className="container mx-auto px-4 py-16" data-testid="page-pricing">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4" data-testid="heading-pricing">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Unlock AI-powered scholarship matching and application support.
            Credits never expire.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Transparent pricing: 4x markup on AI services to support platform development
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {packages.map((pkg) => (
            <Card 
              key={pkg.name}
              className={pkg.popular ? 'border-primary shadow-lg' : ''}
              data-testid={`card-package-${pkg.name.toLowerCase()}`}
            >
              {pkg.popular && (
                <div className="bg-primary text-primary-foreground text-center py-1 text-sm font-medium">
                  Most Popular
                </div>
              )}
              <CardHeader>
                <CardTitle data-testid={`title-${pkg.name.toLowerCase()}`}>
                  {pkg.name}
                </CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold" data-testid={`price-${pkg.name.toLowerCase()}`}>
                    ${pkg.price}
                  </span>
                  <span className="text-muted-foreground"> / {pkg.credits} credits</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {pkg.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full"
                  variant={pkg.popular ? 'default' : 'outline'}
                  data-testid={`button-purchase-${pkg.name.toLowerCase()}`}
                  onClick={() => handleCheckout(pkg)}
                  disabled={isLoading === pkg.name}
                >
                  {isLoading === pkg.name ? 'Processing...' : pkg.cta}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-4">How Credits Work</h2>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-8">
            <div>
              <h3 className="font-semibold mb-2">Purchase</h3>
              <p className="text-sm text-muted-foreground">
                Buy credit packages that fit your needs. Credits never expire.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Use AI Features</h3>
              <p className="text-sm text-muted-foreground">
                Each AI-powered action (essay feedback, matching, etc.) uses credits.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Track Usage</h3>
              <p className="text-sm text-muted-foreground">
                Monitor your credit balance and usage history in your dashboard.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
