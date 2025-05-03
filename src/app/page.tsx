import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BarChart3, Users, ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md text-center shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary">QuizTime Champions</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Welcome to the ultimate real-time quiz challenge!
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col space-y-4">
           <Link href="/quiz" passHref>
            <Button className="w-full" variant="default" size="lg">
              <Users className="mr-2" /> Join Quiz
            </Button>
          </Link>
           <Link href="/scores" passHref>
            <Button className="w-full" variant="secondary" size="lg">
             <BarChart3 className="mr-2" /> View Scores
            </Button>
          </Link>
           <Link href="/admin" passHref>
            <Button className="w-full" variant="outline" size="lg">
               <ShieldCheck className="mr-2" /> Admin Panel
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
