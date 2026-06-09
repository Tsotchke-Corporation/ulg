#include "src/algorithms/vqe.h"
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <complex.h>
#include <string.h>
static void pauli2(char p, double _Complex m[2][2]){
  memset(m,0,sizeof(double _Complex)*4);
  if(p=='X'){ m[0][1]=1; m[1][0]=1; }
  else if(p=='Y'){ m[0][1]=-I; m[1][0]=I; }
  else if(p=='Z'){ m[0][0]=1; m[1][1]=-1; }
  else { m[0][0]=1; m[1][1]=1; }
}
static double gse(const pauli_hamiltonian_t *H){
  size_t nq=H->num_qubits, D=(size_t)1<<nq;
  double _Complex *M=calloc(D*D,sizeof(double _Complex)); double snorm=0;
  for(size_t t=0;t<H->num_terms;t++){
    const char *ps=H->terms[t].pauli_string;
    if(!ps||H->terms[t].num_qubits!=nq) continue;
    double c=H->terms[t].coefficient; snorm+=fabs(c);
    for(size_t a=0;a<D;a++) for(size_t b=0;b<D;b++){
      double _Complex prod=c;
      for(size_t q=0;q<nq&&prod!=0;q++){ int ba=(a>>(nq-1-q))&1,bb=(b>>(nq-1-q))&1; double _Complex pm[2][2]; pauli2(ps[q],pm); prod*=pm[ba][bb]; }
      M[a*D+b]+=prod;
    }
  }
  double s=snorm+1.0,lambda=0;
  double _Complex *v=calloc(D,sizeof(double _Complex)),*w=calloc(D,sizeof(double _Complex));
  for(size_t i=0;i<D;i++) v[i]=(i==0)?1.0:0.0001*(double)(i+1);
  for(int it=0;it<4000;it++){
    for(size_t a=0;a<D;a++){ double _Complex acc=s*v[a]; for(size_t b=0;b<D;b++) acc-=M[a*D+b]*v[b]; w[a]=acc; }
    double nrm=0; for(size_t a=0;a<D;a++) nrm+=creal(conj(w[a])*w[a]); nrm=sqrt(nrm);
    for(size_t a=0;a<D;a++) v[a]=w[a]/nrm;
    double num=0; for(size_t a=0;a<D;a++){ double _Complex acc=s*v[a]; for(size_t b=0;b<D;b++) acc-=M[a*D+b]*v[b]; num+=creal(conj(v[a])*acc); }
    lambda=num;
  }
  free(M);free(v);free(w); return s-lambda;
}
int main(void){
  setvbuf(stdout,NULL,_IONBF,0);
  printf("{\"h2_pes\":[");
  double dists[]={0.4,0.5,0.6,0.7,0.7414,0.8,0.9,1.0,1.1,1.4,1.8,2.2,2.5};
  int n=(int)(sizeof(dists)/sizeof(dists[0]));
  for(int i=0;i<n;i++){
    pauli_hamiltonian_t *H=vqe_create_h2_hamiltonian(dists[i]);
    double e=gse(H);
    printf("%s{\"bondAngstrom\":%.4f,\"totalEnergyHa\":%.9f}", i?",":"", dists[i], e+H->nuclear_repulsion);
    pauli_hamiltonian_free(H);
  }
  printf("],\"h2o\":");
  pauli_hamiltonian_t *W=vqe_create_h2o_hamiltonian();
  double ew=gse(W);
  printf("{\"numQubits\":%zu,\"nuclearRepulsionHa\":%.9f,\"electronicHa\":%.9f,\"totalEnergyHa\":%.9f}",
         W->num_qubits, W->nuclear_repulsion, ew, ew+W->nuclear_repulsion);
  pauli_hamiltonian_free(W);
  printf("}\n");
  return 0;
}
